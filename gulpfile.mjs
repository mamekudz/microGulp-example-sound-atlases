import {InstallStringExtensions} from 'gulp-mu-gulp-api';
import {CheckPackageVersions,GetVersionString} from './tools/RecipeRelease.mjs';
InstallStringExtensions();CheckPackageVersions();
export const µI18xContext={version:GetVersionString()};
export async function BUILD_ATLAS(){const {Build}=await import('./tools/Build.mjs');await Build();}
BUILD_ATLAS.µKeyBinding = { key: 'ctrl+shift+F6', mac: 'cmd+shift+F6' };
BUILD_ATLAS.µDisplayName='Build sound atlas V<version/><context="µDisplayName"/>'.i18xRegister();
BUILD_ATLAS.µGroup='Audio<context="µGroup"/>'.i18xRegister();
BUILD_ATLAS.µExecutionConcurrency=false;
