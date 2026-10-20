// ===========================================
// i18x-engine.mjs - eval-free i18x runtime core
// © 1996-2026 Meinolf Amekudzi
// (published under MIT license)
// ===========================================

/**
 * Dependency-free, eval-free implementation of the i18x rendering engine.
 *
 * This is a faithful port of the canonical i18x runtime (µLib `i18x.mjs` and
 * the i18xe C# `i18x.Trans`/`CreateFormatPlaceholders`), rebuilt as a pure
 * interpreter so it runs unchanged in a Node process and inside a
 * Content-Security-Policy-restricted webview (no `eval`, no `new Function`).
 *
 * The engine renders the i18x XML notation:
 *   - placeholder tags: `<name/>`, `<name format="int"/>`
 *   - conditionals:     `<x if="0-">-</x>`, `<n if="1~">s</n>` (`if`/`ifnot`/`ifin`/`ifnotin`)
 *   - inline formats:   `<format name="…" …>…</format>` (also nested)
 *   - value transforms: `expression="=round(x*100)/100"`
 *   - enumerations:     `<hour enumeration="AM|PM"/>`
 *   - digit tags:       `<i0/>`…`<iN/>` (integer), `<f0/>`… (fixed fraction),
 *                       `<g0/>` (grouped fraction), `<r0/>` (roman), `<i/>`/`<f/>` (whole part)
 *   - date/time tags:   `<day/>`, `<month/>` (0-based), `<year/>`, `<hour/>`, `<minute/>`,
 *                       `<second/>`, `<weekday/>` and their `utc…` variants
 *   - entities:         `<lt/>`, `<gt/>`, `<space/>`, `<nbsp/>`, `<br/>`, `<newline/>`, …
 *
 * NOTE: The `<m…/>` (zero-cut fraction) tags render empty here, mirroring the
 * canonical µLib runtime. They are slated for a rework together with the i18x
 * format catalog; do not rely on `<m…/>` output until then.
 *
 * @module gulp-mu-gulp-api/i18x-engine
 */

// -------------------------------------------------
// expression evaluator (recursive descent, no eval)
// -------------------------------------------------

const EXPRESSION_FUNCTIONS = {
	abs: (_a) => Math.abs(_a),
	acos: (_a) => Math.acos(_a),
	asin: (_a) => Math.asin(_a),
	atan: (_a) => Math.atan(_a),
	atan2: (_a, _b) => Math.atan2(_a, _b),
	ceil: (_a) => Math.ceil(_a),
	ceiling: (_a) => Math.ceil(_a),
	cos: (_a) => Math.cos(_a),
	cosh: (_a) => Math.cosh(_a),
	exp: (_a) => Math.exp(_a),
	fact: (_a) => {
		let n = Math.floor(_a);
		if (n < 0) return NaN;
		let result = 1;
		for (let k = 2; k <= n; k++) result *= k;
		return result;
	},
	floor: (_a) => Math.floor(_a),
	frac: (_a) => _a - Math.trunc(_a),
	int: (_a) => Math.trunc(_a),
	ln: (_a) => Math.log(_a),
	log: (_a, _b) => (_b === undefined ? Math.log10(_a) : Math.log(_a) / Math.log(_b)),
	max: (..._args) => Math.max(..._args),
	min: (..._args) => Math.min(..._args),
	pow: (_a, _b) => Math.pow(_a, _b),
	round: (_a) => Math.round(_a),
	sign: (_a) => Math.sign(_a),
	sin: (_a) => Math.sin(_a),
	sinh: (_a) => Math.sinh(_a),
	sqr: (_a) => _a * _a,
	sqrt: (_a) => Math.sqrt(_a),
	tan: (_a) => Math.tan(_a),
	tanh: (_a) => Math.tanh(_a),
	trunc: (_a) => Math.trunc(_a),
};

const EXPRESSION_CACHE = new Map();

/** Tokenizes an i18x expression string into numbers, identifiers and operators. */
function _TokenizeExpression(_source) {
	let tokens = [];
	let index = 0;
	let length = _source.length;
	while (index < length) {
		let ch = _source[index];
		if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
			index++;
			continue;
		}
		if ((ch >= '0' && ch <= '9') || ch === '.') {
			let start = index;
			while (index < length && ((_source[index] >= '0' && _source[index] <= '9') || _source[index] === '.')) index++;
			tokens.push({ type: 'number', value: parseFloat(_source.slice(start, index)) });
			continue;
		}
		if ((ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_') {
			let start = index;
			while (index < length && ((_source[index] >= 'a' && _source[index] <= 'z') || (_source[index] >= 'A' && _source[index] <= 'Z') || (_source[index] >= '0' && _source[index] <= '9') || _source[index] === '_')) index++;
			tokens.push({ type: 'ident', value: _source.slice(start, index) });
			continue;
		}
		tokens.push({ type: 'op', value: ch });
		index++;
	}
	return tokens;
}

/**
 * Evaluates an i18x `expression="…"` value against the bound variable `x`.
 * The leading `=` (if present) is stripped. Supports `+ - * / %`, unary minus,
 * parentheses and the math functions listed in EXPRESSION_FUNCTIONS.
 * @param {string} _source expression source (with or without leading `=`)
 * @param {number} _x value bound to the variable `x`
 * @returns {number}
 */
export function EvalExpression(_source, _x) {
	let source = String(_source);
	if (source.charAt(0) === '=') source = source.slice(1);
	let tokens = EXPRESSION_CACHE.get(source);
	if (!tokens) {
		tokens = _TokenizeExpression(source);
		EXPRESSION_CACHE.set(source, tokens);
	}
	let position = 0;

	function _Peek() { return tokens[position]; }
	function _Next() { return tokens[position++]; }

	function _ParsePrimary() {
		let token = _Peek();
		if (!token) return 0;
		if (token.type === 'op' && token.value === '(') {
			_Next();
			let value = _ParseExpression();
			if (_Peek() && _Peek().value === ')') _Next();
			return value;
		}
		if (token.type === 'op' && token.value === '-') {
			_Next();
			return -_ParsePrimary();
		}
		if (token.type === 'op' && token.value === '+') {
			_Next();
			return _ParsePrimary();
		}
		if (token.type === 'number') {
			_Next();
			return token.value;
		}
		if (token.type === 'ident') {
			_Next();
			let name = token.value;
			if (_Peek() && _Peek().value === '(') {
				_Next();
				let args = [];
				if (!(_Peek() && _Peek().value === ')')) {
					args.push(_ParseExpression());
					while (_Peek() && _Peek().value === ',') {
						_Next();
						args.push(_ParseExpression());
					}
				}
				if (_Peek() && _Peek().value === ')') _Next();
				let fn = EXPRESSION_FUNCTIONS[name];
				return fn ? Number(fn(...args)) : 0;
			}
			if (name === 'x') return Number(_x);
			return 0;
		}
		_Next();
		return 0;
	}

	function _ParseTerm() {
		let value = _ParsePrimary();
		while (_Peek() && _Peek().type === 'op' && (_Peek().value === '*' || _Peek().value === '/' || _Peek().value === '%')) {
			let op = _Next().value;
			let right = _ParsePrimary();
			if (op === '*') value *= right;
			else if (op === '/') value /= right;
			else value %= right;
		}
		return value;
	}

	function _ParseExpression() {
		let value = _ParseTerm();
		while (_Peek() && _Peek().type === 'op' && (_Peek().value === '+' || _Peek().value === '-')) {
			let op = _Next().value;
			let right = _ParseTerm();
			if (op === '+') value += right;
			else value -= right;
		}
		return value;
	}

	let result = _ParseExpression();
	return Number.isFinite(result) ? result : 0;
}

// -------------------------------------------------
// roman numerals
// -------------------------------------------------

const ROMAN_TABLE = [
	[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'],
	[50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
];

/** Converts a non-negative integer to its Roman-numeral string. */
export function ToRoman(_value) {
	let n = Math.abs(Math.round(Number(_value) || 0));
	let out = '';
	for (let [amount, symbol] of ROMAN_TABLE) {
		while (n >= amount) {
			out += symbol;
			n -= amount;
		}
	}
	return out;
}

// -------------------------------------------------
// format definitions
// -------------------------------------------------

/**
 * Parses a `<format …>…</format>` definition into a reusable descriptor:
 * name, attribute map, inner XML body and the pre-scanned maximum digit index
 * per digit class (needed for the fill/padding logic).
 * @param {string} _def full `<format …>…</format>` source
 * @returns {{ name: string, attrs: object, xml: string, maxes: object, flags: object, hasDateTags: boolean }}
 */
export function ParseFormatDef(_def) {
	let def = String(_def);
	let start = def.indexOf('<format');
	let headerEnd = def.indexOf('>', start);
	let attrsText = def.slice(start + 7, headerEnd);
	let bodyStart = headerEnd + 1;
	let bodyEnd = def.lastIndexOf('</format>');
	let xml = bodyEnd >= 0 ? def.slice(bodyStart, bodyEnd) : def.slice(bodyStart);
	let attrs = _ParseAttributes(attrsText);
	return {
		name: attrs.name ?? '',
		attrs,
		xml,
		maxes: _ScanDigitMaxes(xml),
		hasDateTags: /<\/?(?:utc)?(?:day|month|year|hour|minute|second|millisecond|weekday|weekofyear|dayofyear|timezone(?:offset|short|place)?|summertimeoffset)[\s/>]/.test(xml),
	};
}

/** Parses an XML attribute list (`name="value" …`) into a plain object. */
function _ParseAttributes(_attrsText) {
	let attrs = {};
	let regex = /([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*"([^"]*)"/g;
	let match;
	while ((match = regex.exec(_attrsText)) !== null) attrs[match[1]] = match[2];
	return attrs;
}

/** Pre-scans a format body for the highest `<iN/>`, `<fN/>`, `<gN/>`, `<rN/>` index. */
function _ScanDigitMaxes(_xml) {
	let maxes = { i: 0, f: 0, g: 0, r: 0 };
	let regex = /<([ifgr])(\d+)\s*\/?>/g;
	let match;
	while ((match = regex.exec(_xml)) !== null) {
		let cls = match[1];
		let idx = parseInt(match[2], 10);
		if (idx + 1 > maxes[cls]) maxes[cls] = idx + 1;
	}
	return maxes;
}

/**
 * Registers a `<format …>` definition into a name-keyed map.
 * @param {Object<string, object>} _formats target map (mutated)
 * @param {string} _def format source
 * @param {boolean} [_onlyIfNotExists] keep an existing entry with the same name
 */
export function RegisterFormat(_formats, _def, _onlyIfNotExists) {
	let parsed = ParseFormatDef(_def);
	if (!parsed.name) return;
	if (_onlyIfNotExists && Object.prototype.hasOwnProperty.call(_formats, parsed.name)) return;
	_formats[parsed.name] = parsed;
}

// -------------------------------------------------
// value decomposition (CreateFormatPlaceholders port)
// -------------------------------------------------

/** Builds the digit-fill array exactly as the canonical engine does. */
function _BuildFill(_count, _chr, _maxNo) {
	let ret = [];
	if (_maxNo > 0) {
		let maxNo = _maxNo > _count ? _count : _maxNo;
		for (let n = 0; n < maxNo; n++) ret.push(_chr);
		for (let n = maxNo; n < _count; n++) ret.push('');
		ret.reverse();
	} else {
		for (let n = 0; n < _count; n++) ret.push(_chr);
	}
	return ret;
}

/** Applies a `0=零|1=一`-style digit replacement map to a numeric string. */
function _ApplyDigitMap(_string, _digitsAttr) {
	if (!_digitsAttr) return _string;
	let map = {};
	for (let pair of _digitsAttr.split('|')) {
		let [key, value] = pair.split('=');
		if (key !== undefined && value !== undefined) map[key] = value;
	}
	let out = '';
	for (let ch of _string) out += Object.prototype.hasOwnProperty.call(map, ch) ? map[ch] : ch;
	return out;
}

/**
 * Decomposes a numeric value into the placeholder set consumed by a number
 * format body: `x`, `xa`, whole-part `i`/`f`, indexed `i0…`, `f0…`, `g0…`,
 * roman `r0…`.
 */
function _NumberPlaceholders(_value, _def) {
	let attrs = _def.attrs;
	let base = parseInt(attrs.base ?? '10', 10) || 10;
	let value = Number(_value) || 0;
	if (attrs.expression) value = EvalExpression(attrs.expression, value);
	let xa = Math.abs(value);
	let numericString = base === 10 ? xa.toString() : Math.trunc(xa).toString(base);
	numericString = _ApplyDigitMap(numericString, attrs.digits);
	let parts = numericString.split('.');
	let intString = parts[0] ?? '';
	let fracString = parts[1] ?? '';

	let placeholders = { x: value, xa, i: intString, f: fracString };

	let iMax = _def.maxes.i;
	if (iMax > 0) {
		let fill = _BuildFill(iMax, attrs.ifillchr ?? '', parseInt(attrs.ifillmax ?? '0', 10) || 0);
		let digits = intString.split('').reverse().concat(fill);
		for (let n = 0; n < iMax; n++) placeholders['i' + n] = digits[n] ?? '';
	}

	let fMax = _def.maxes.f;
	if (fMax > 0) {
		let fill = _BuildFill(fMax, attrs.ffillchr ?? '', parseInt(attrs.ffillmax ?? '0', 10) || 0);
		let digits = fracString.split('').concat(fill);
		for (let n = 0; n < fMax; n++) placeholders['f' + n] = digits[n] ?? '';
	}

	let gMax = _def.maxes.g;
	if (gMax > 0) {
		let fill = _BuildFill(gMax, attrs.gfillchr ?? '', parseInt(attrs.gfillmax ?? '0', 10) || 0);
		let digits = fracString.split('').concat(fill);
		for (let n = 0; n < gMax; n++) placeholders['g' + n] = digits[n] ?? '';
	}

	let rMax = _def.maxes.r;
	if (rMax > 0) {
		let roman = ToRoman(value).split('').reverse();
		let fill = _BuildFill(rMax, attrs.rfillchr ?? '', parseInt(attrs.rfillmax ?? '0', 10) || 0);
		let digits = roman.concat(fill);
		for (let n = 0; n < rMax; n++) placeholders['r' + n] = digits[n] ?? '';
	}

	return placeholders;
}

const WALL_CLOCK_FORMATTERS = new Map();

/** Extracts wall-clock components for a timestamp in a given IANA timezone. */
function _WallClockParts(_timestampMs, _timeZone) {
	let tz = _timeZone || 'UTC';
	let formatter = WALL_CLOCK_FORMATTERS.get(tz);
	if (!formatter) {
		try {
			formatter = new Intl.DateTimeFormat('en-US', {
				timeZone: tz, hour12: false, weekday: 'short',
				year: 'numeric', month: '2-digit', day: '2-digit',
				hour: '2-digit', minute: '2-digit', second: '2-digit',
			});
		} catch {
			formatter = new Intl.DateTimeFormat('en-US', {
				hour12: false, weekday: 'short',
				year: 'numeric', month: '2-digit', day: '2-digit',
				hour: '2-digit', minute: '2-digit', second: '2-digit',
			});
		}
		WALL_CLOCK_FORMATTERS.set(tz, formatter);
	}
	let values = {};
	for (let part of formatter.formatToParts(new Date(Number(_timestampMs) || 0))) values[part.type] = part.value;
	let weekdayIndex = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[values.weekday] ?? 0;
	let hour = parseInt(values.hour, 10) % 24;
	return {
		day: parseInt(values.day, 10),
		month: parseInt(values.month, 10) - 1,
		year: parseInt(values.year, 10),
		hour,
		minute: parseInt(values.minute, 10),
		second: parseInt(values.second, 10),
		weekday: weekdayIndex,
	};
}

/** ISO-8601 week number (1..53) for a calendar date (month is 0-based). */
function _IsoWeekOfYear(_year, _month, _day) {
	let d = new Date(Date.UTC(_year, _month, _day));
	let dayOfWeek = d.getUTCDay();
	if (dayOfWeek === 0) dayOfWeek = 7;
	d.setUTCDate(d.getUTCDate() + 4 - dayOfWeek);
	let yearStart = Date.UTC(d.getUTCFullYear(), 0, 1);
	return Math.ceil(((d.getTime() - yearStart) / 86400000 + 1) / 7);
}

/** Day of year (1..366) for a calendar date (month is 0-based). */
function _DayOfYear(_year, _month, _day) {
	let start = Date.UTC(_year, 0, 1);
	let current = Date.UTC(_year, _month, _day);
	return Math.floor((current - start) / 86400000) + 1;
}

/** JavaScript-compatible getTimezoneOffset (minutes to add to local time to get UTC). */
function _TimeZoneOffsetJsMinutes(_ms, _timeZone) {
	let ms = Number(_ms) || 0;
	let local = _WallClockParts(ms, _timeZone);
	let utcDate = new Date(ms);
	let wallAsUTC = Date.UTC(
		local.year, local.month, local.day,
		local.hour, local.minute, local.second, utcDate.getUTCMilliseconds(),
	);
	return Math.round((ms - wallAsUTC) / 60000);
}

const TIME_ZONE_SHORT_FORMATTERS = new Map();

/** Best-effort timezone abbreviation via Intl (no TZNames database). */
function _TimeZoneShort(_ms, _timeZone, _lid) {
	let key = (_lid || 'en-US') + '\0' + (_timeZone || 'UTC');
	let formatter = TIME_ZONE_SHORT_FORMATTERS.get(key);
	if (!formatter) {
		try {
			formatter = new Intl.DateTimeFormat(_lid || 'en-US', { timeZone: _timeZone || 'UTC', timeZoneName: 'short' });
		} catch {
			formatter = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', timeZoneName: 'short' });
		}
		TIME_ZONE_SHORT_FORMATTERS.set(key, formatter);
	}
	try {
		for (let part of formatter.formatToParts(new Date(Number(_ms) || 0))) {
			if (part.type === 'timeZoneName') return part.value;
		}
	} catch {
		// Invalid timezone - leave empty.
	}
	return '';
}

/** Decomposes a timestamp into date/time placeholders (local tz + utc variants). */
function _DatePlaceholders(_value, _timeZone, _lid) {
	let ms = Number(_value) || 0;
	let tz = _timeZone || 'UTC';
	let local = _WallClockParts(ms, tz);
	let utcDate = new Date(ms);
	return {
		day: local.day, month: local.month, year: local.year,
		hour: local.hour, minute: local.minute, second: local.second,
		weekday: local.weekday, millisecond: utcDate.getUTCMilliseconds(),
		weekofyear: _IsoWeekOfYear(local.year, local.month, local.day),
		dayofyear: _DayOfYear(local.year, local.month, local.day),
		timezone: tz,
		timezoneoffset: _TimeZoneOffsetJsMinutes(ms, tz),
		timezoneshort: _TimeZoneShort(ms, tz, _lid),
		timezoneplace: tz,
		utcday: utcDate.getUTCDate(), utcmonth: utcDate.getUTCMonth(), utcyear: utcDate.getUTCFullYear(),
		utchour: utcDate.getUTCHours(), utcminute: utcDate.getUTCMinutes(), utcsecond: utcDate.getUTCSeconds(),
		utcweekday: utcDate.getUTCDay(), utcmillisecond: utcDate.getUTCMilliseconds(),
		utcweekofyear: _IsoWeekOfYear(utcDate.getUTCFullYear(), utcDate.getUTCMonth(), utcDate.getUTCDate()),
		utcdayofyear: _DayOfYear(utcDate.getUTCFullYear(), utcDate.getUTCMonth(), utcDate.getUTCDate()),
	};
}

// -------------------------------------------------
// named-format rendering
// -------------------------------------------------

/**
 * Formats a value with a named format definition.
 * @param {number} _value
 * @param {string} _formatName
 * @param {object} _ctx render context `{ lid, timeZone, formats }`
 * @returns {string}
 */
export function FormatValue(_value, _formatName, _ctx) {
	let def = _ResolveFormat(_formatName, _ctx);
	if (!def) return String(_value);
	let placeholders = _NumberPlaceholders(_value, def);
	if (def.hasDateTags) Object.assign(placeholders, _DatePlaceholders(_value, _ctx.timeZone, _ctx.lid), { x: Number(_value) || 0 });
	return Trans(def.xml, placeholders, _ctx);
}

/** Resolves a format by name from the local defs, then the context registry. */
function _ResolveFormat(_name, _ctx, _localFormats) {
	if (_localFormats && Object.prototype.hasOwnProperty.call(_localFormats, _name)) return _localFormats[_name];
	let formats = _ctx.formats;
	if (formats && Object.prototype.hasOwnProperty.call(formats, _name)) return formats[_name];
	return null;
}

// -------------------------------------------------
// entity tags
// -------------------------------------------------

const ENTITY_TAGS = {
	lt: '<', gt: '>', obrc: '{', cbrc: '}', brl: '\u25C4', brr: '\u25BA',
	br: '<br/>', newline: '\n', slashnewline: '\\n', quot: '"', quote: '"',
	squot: "'", apos: "'", singlequote: "'", space: ' ', whitespace: ' ',
	amp: '&', nbsp: '\u00A0', tab: '\t', hyphen: '\u00AD', '-': '\u00AD',
	newpage: '\u21A1',
};

// -------------------------------------------------
// core interpreter (i18x.Trans port)
// -------------------------------------------------

/**
 * Renders an i18x XML string against a placeholder set. This is the shared
 * interpreter used both for translated phrases and for format bodies.
 * @param {string} _text i18x XML source (already looked up / translated)
 * @param {object} [_placeholders] values for `<name/>` tags
 * @param {object} [_ctx] render context `{ lid, timeZone, formats }`
 * @returns {string}
 */
export function Trans(_text, _placeholders, _ctx) {
	if (_text == null) return '';
	let text = String(_text);
	if (text.indexOf('<') === -1) return text;

	let placeholders = _placeholders ?? {};
	let ctx = _ctx ?? { lid: 'en-US', timeZone: 'UTC', formats: {} };
	let localFormats = null;

	let tokens = ('<i18x>' + text + '</i18x>').split('<');
	let level = 0;
	let txts = [''];
	let visibles = [true];
	let length = tokens.length;

	for (let i = 0; i < length; i++) {
		let token = tokens[i];
		let closeIndex = token.indexOf('>');
		if (closeIndex === -1) {
			txts[level] += token;
			continue;
		}

		let trailing = token.slice(closeIndex + 1);
		let isClosingTag = token.charAt(0) === '/';
		let isClosedTag = token.charAt(closeIndex - 1) === '/';
		let sliceStart = 0;
		let sliceEnd = closeIndex;
		if (isClosedTag) sliceEnd -= 1;
		if (isClosingTag) { sliceStart = 1; sliceEnd -= 1; }

		let head = token.slice(sliceStart, sliceEnd);
		let spaceIndex = head.indexOf(' ');
		let tag = spaceIndex === -1 ? head : head.slice(0, spaceIndex);
		let attrs = spaceIndex === -1 ? {} : _ParseAttributes(head.slice(spaceIndex + 1));

		// inline <format> definitions: collect the raw block (honoring nesting),
		// register it locally and skip over it without rendering its body.
		if (tag === 'format' && !isClosingTag && !isClosedTag) {
			let depth = 1;
			let j = i;
			while (depth > 0 && ++j < length) {
				let inner = tokens[j];
				let innerClose = inner.indexOf('>');
				if (innerClose === -1) continue;
				let innerClosing = inner.charAt(0) === '/';
				let innerClosed = inner.charAt(innerClose - 1) === '/';
				let innerHead = inner.slice(innerClosing ? 1 : 0, innerClose);
				let innerSpace = innerHead.indexOf(' ');
				let innerTag = innerSpace === -1 ? innerHead.replace(/\/$/, '') : innerHead.slice(0, innerSpace);
				if (innerTag === 'format') {
					if (innerClosing) depth--;
					else if (!innerClosed) depth++;
				}
			}
			let defSource = '<' + tokens.slice(i, j + 1).join('<');
			if (!localFormats) localFormats = Object.create(null);
			RegisterFormat(localFormats, defSource, true);
			if (j < length) txts[level] += tokens[j].slice(tokens[j].indexOf('>') + 1);
			i = j;
			continue;
		}

		let value = '';
		let doInsertValue = false;
		let tagVisible = true;

		if (isClosingTag) {
			level--;
			txts[level] += visibles[level + 1] ? txts[level + 1] : '';
			txts[level] += trailing;
			continue;
		} else if (isClosedTag) {
			doInsertValue = true;
		} else {
			level++;
			txts[level] = '';
			visibles[level] = true;
		}

		if (Object.prototype.hasOwnProperty.call(placeholders, tag)) {
			let raw = placeholders[tag];
			value = raw instanceof Date ? raw.getTime() : raw;
		}
		if (Object.prototype.hasOwnProperty.call(ENTITY_TAGS, tag)) value = ENTITY_TAGS[tag];

		// process attributes in document order: value, expression, format, enumeration, if.
		for (let attrKey of Object.keys(attrs)) {
			let attrValue = attrs[attrKey];
			if (attrKey === 'value') {
				value = attrValue;
			} else if (attrKey === 'expression') {
				value = EvalExpression(attrValue, Number(value) || 0);
			} else if (attrKey === 'format') {
				let def = _ResolveFormat(attrValue, ctx, localFormats);
				if (def) {
					let subContext = localFormats ? { ...ctx, formats: { ...(ctx.formats ?? {}), ...localFormats } } : ctx;
					value = FormatValue(Number(value) || 0, attrValue, subContext);
				} else {
					// Missing named format must not swallow the placeholder (e.g.
					// gulp lifecycle "after <duration format="progressDuration"/>"
					// would otherwise render as "Finished 'task' after ").
					value = value === undefined || value === null ? '' : String(value);
				}
			} else if (attrKey === 'enumeration') {
				let options = attrValue.split('|');
				let index = parseInt(value, 10);
				value = Number.isFinite(index) && index >= 0 && index < options.length ? options[index] : '';
			} else if (attrKey === 'if' || attrKey === 'ifnot' || attrKey === 'ifin' || attrKey === 'ifnotin') {
				tagVisible = _EvaluateCondition(value, attrValue, attrKey);
			}
		}

		// A self-closing condition controls only this value, never its parent.
		if (!isClosedTag) visibles[level] = tagVisible;
		txts[level] += (doInsertValue && tagVisible ? value : '') + trailing;
	}

	// flush any levels left open by unbalanced tags (e.g. the malformed roman format).
	while (level > 0) {
		txts[level - 1] += visibles[level] ? txts[level] : '';
		level--;
	}

	return txts[0].replace(/\0/g, '');
}

/** Evaluates an `if`/`ifnot`/`ifin`/`ifnotin` condition against a value. */
function _EvaluateCondition(_value, _condition, _attrKey) {
	let numeric = Number(_value);
	let isNumber = _value !== '' && _value !== null && Number.isFinite(numeric);
	let compareNumber = isNumber ? numeric : NaN;
	let compareString = String(_value);
	let isIn = _attrKey === 'ifin' || _attrKey === 'ifnotin';

	let matched = false;
	for (let clause of _condition.split('|')) {
		let operator = clause.charAt(clause.length - 1);
		let operand = clause;
		if (operator === '+' || operator === '-' || operator === '=' || operator === '~' || operator === '*') {
			operand = clause.slice(0, -1);
		} else {
			operator = '';
		}
		let operandNumber = Number(operand);
		let operandIsNumber = operand !== '' && Number.isFinite(operandNumber);

		if (isNumber && operandIsNumber) {
			if (operator === '+') matched = matched || compareNumber > operandNumber;
			else if (operator === '-') matched = matched || compareNumber < operandNumber;
			else if (operator === '=') matched = matched || compareNumber === operandNumber;
			else if (operator === '~') matched = matched || compareNumber !== operandNumber;
			else if (operator === '*') matched = matched || compareString.indexOf(operand) >= 0;
			else matched = matched || compareNumber === operandNumber;
		} else {
			if (operator === '+') matched = matched || compareString > operand;
			else if (operator === '-') matched = matched || compareString < operand;
			else if (operator === '=') matched = matched || compareString === operand;
			else if (operator === '~') matched = matched || compareString !== operand;
			else if (operator === '*') matched = matched || compareString.indexOf(operand) >= 0;
			else if (isIn) matched = matched || compareString.indexOf(operand) >= 0;
			else matched = matched || compareString === operand;
		}
	}
	if (_attrKey === 'ifnot' || _attrKey === 'ifnotin') matched = !matched;
	return matched;
}

/** Removes any remaining i18x/XML tags from a string (after placeholder substitution). */
export function StripTags(_text) {
	return String(_text).replace(/<[^>]*>/g, '');
}
