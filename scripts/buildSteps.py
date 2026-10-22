Import("env")
import shutil
import os
import re
import json
from pathlib import Path



INCLUDE_FILE     = os.path.join(env.subst("$PROJECT_INCLUDE_DIR"),"ProgVersion.h")
VERSION_FILE     = os.path.join(env.subst("$PROJECT_DATA_DIR"),"version.json")
TEST_STATUS_FILE = os.path.join(env.subst("$PROJECT_DIR"),"test","data","status.json")
SETTINGS_FILE 	 = os.path.join(env.subst("$PROJECT_DIR"),"src","web","js","settings.js")
FIRMWARE_SOURCE  = os.path.join(env.subst("$BUILD_DIR"), "firmware.bin")
FIRMWARE_PATH    = os.path.join("bin")
PROJECT_DIR      = os.path.normpath(env.subst("$PROJECT_DIR"))
PACKAGE_FILE	 = os.path.join(env.subst("$PROJECT_DIR"),"package.json")
PARENT_PATH_NAME = os.path.basename(os.path.normpath(env.subst("$PROJECT_DIR")))
MODULE_NAME		 = env.subst("$PIOENV")
OBJECT_FILES	 = os.path.join(env.subst("$PROJECT_DIR"),".pio","build",env.subst("$PIOENV"),"src")
MAIN_OBJ_NAME	 = "main.cpp.o"
MAIN_OBJ_FILE	 = os.path.join(OBJECT_FILES,MAIN_OBJ_NAME)

oPackageFile = {
	"version": "0.1.0"
}

oDefaultVersion = {
	"name": PARENT_PATH_NAME,
	"major": 0,
	"minor": 1,
	"patch": 0,
	"build": 0,
}
# print("Current CLI targets", COMMAND_LINE_TARGETS)
# print("Current Build targets", BUILD_TARGETS)
# print("Current Device : ", env.subst("$BOARD"))

#
# Dump build environment (for debug to see possible vars)
# print(env.Dump())
#

def forceToCompileMain():
	if(os.path.exists(MAIN_OBJ_FILE)):
		print(f' * - removing {MAIN_OBJ_FILE}')
		os.remove(MAIN_OBJ_FILE)


def writeVersionIncludeFile(oVersion):
	Path(INCLUDE_FILE).parent.mkdir(exist_ok=True, parents=True)
	with open(INCLUDE_FILE,'w+') as oFP:
		oFP.writelines([
			'#pragma once' 
			'\n// (c) LSC Labs'
			'\n// This file will be build by the runtime, so do not change here.'
			'\n// If you want to change the major/minor/patch version nummer, use the file data/prog_ver.json.'
			'\n// The build nummer will be incremented in this file by platform.io -> prebuild steps'
			'\n'
			f'\n#define PROG_VERSION_NAME  \"{oVersion["name"]}\"'
			f'\n#define PROG_AUTHOR        \"{oVersion["author"]}\"'
			f'\n#define PROG_HOMEPAGE      \"{oVersion["homepage"]}\"\n'
			f'\n#define PROG_VERSION_MAJOR {oVersion["major"]}'
			f'\n#define PROG_VERSION_MINOR {oVersion["minor"]}'
			f'\n#define PROG_VERSION_PATCH {oVersion["patch"]}'
			f'\n#define PROG_VERSION_BUILD {oVersion["build"]}'
			f'\n#define PROG_VERSION       \"{oVersion["major"]}.{oVersion["minor"]}.{oVersion["patch"]}\"'
			f'\n#define PROG_VERSION_SHORT \"{oVersion["major"]}.{oVersion["minor"]}\"'
			f'\n#define PROG_VERSION_LONG  \"{oVersion["major"]}.{oVersion["minor"]}.{oVersion["patch"]}.{oVersion["build"]}\"'
			])
		
		oFP.close()

def updateJsonSettings(oVersion):
	# Update the settings.js test file...
	print("-> updating json settings")
	strRegSearchProgName = r"\"prog_name\"\s*:\s*\"([\-A-Za-z0-9_\s]*)\""
	strRegSearchProgVer  = r"\"prog_ver\"\s*:\s*\"([.\-A-Z0-9_]*)\""
	if os.path.exists(SETTINGS_FILE):
		tLines = []
		with open(SETTINGS_FILE, 'r') as oFP:
			for strLine in oFP:
				if re.search(strRegSearchProgName,strLine):
					strLine = f'{strLine[:strLine.index(":")]}:"{oVersion["name"]}",\n'
				if re.search(strRegSearchProgVer,strLine):
					strLine = f'{strLine[:strLine.index(":")]}:"{oVersion["major"]}.{oVersion["minor"]}",\n'
				tLines.append(strLine)
			oFP.close()
			
		with open(SETTINGS_FILE, 'w') as oFP:
			for strLine in tLines:
				oFP.write(strLine)

# Correct the testdata status file with the prog_name and version from version object
def updateTestDataInfo(oVersion):
	# Update the status.json test file...
	print("-> updating test status")
	if os.path.exists(TEST_STATUS_FILE):
		with open(TEST_STATUS_FILE, 'r') as oFP:
			oTestStatus = json.load(oFP)
			oFP.close()
			oTestStatus["prog_name"] = oVersion["name"]
			oTestStatus["prog_version"] = f'{getVersionStringOf(oVersion)}-T'
			print(f'writing version {oTestStatus["prog_version"]}')
			with open(TEST_STATUS_FILE, 'w') as oFP:
				# "Version: {oVersion['major']}.{oVersion['minor']}.{oVersion['patch']}.{oVersion['build'}")
				json.dump(oTestStatus,oFP,indent=4)
				oFP.close()
			
			
def getVersionStringOf(oVersion):
	strVersion = str(oVersion["major"]) + "." + str(oVersion["minor"]) + "." + str(oVersion["patch"]) + "." + str(oVersion["build"])
	return(strVersion)
	

def getTargetFirmwareName(env):
	projectPath = env['PROJECT_DIR']
	# os.path.basename extrahiert daraus nur den letzten Ordnernamen (den Projektnamen)
	projectName = os.path.basename(projectPath)
	strFileName = projectName + " - " + env.subst("$PIOENV")
	if strFileName.endswith("_debug"):
		strFileName +=  " (firmware).bin"
	else:
		with open(VERSION_FILE, 'r') as oFP:
			oVersion = json.load(oFP)
			oFP.close()
		strFileName += " (firmware " + getVersionStringOf(oVersion) + ").bin"
	return(os.path.join("bin",strFileName))
	
# Does the version of the project (package) match the program version (version) ?
def doesVersionMatch():
	if(oPackageFile["version"]):
		print(f' * - Project version (package.json) : {oPackageFile["version"]}')
		print(f' * - Current version number         : {getVersionStringOf(oVersion)}')
		tVersion = oPackageFile["version"].split(".")
		if(len(tVersion) == 3):
			return(oVersion["major"] == tVersion[0] and oVersion["minor"] == tVersion[1] and oVersion["patch"] == tVersion[2])
	return False



def after_build(source, target, env):
#	shutil.copy(firmware_source, 'bin/d1_mini-firmware.bin')
	strTargetFile = getTargetFirmwareName(env)
	print(f' * -> storing final firmware bin to "{strTargetFile}"')
	Path(strTargetFile).parent.mkdir(exist_ok=True, parents=True)
	shutil.copy(FIRMWARE_SOURCE,strTargetFile)

##################################################################
# Function called, before build is started...
# Checks package.json version against program version.
# - if different versions, the program version will be justified,
#	build version will be set to 0, as it is the first one...
# - if the same version, build version will be incremented
#
# Ensure, the version string in package.json contains 3 digits
# like 0.1.2
##################################################################
def before_build(source, target, env):
	strEnv = env.subst("$PIOENV")
	# build the web interface in any case 
	# strCWD = os.getcwd()
	# os.chdir("tools/webfilesbuilder/")
	# os.system("echo current dir :&& pwd && npm run start")
	# os.chdir(strCWD)
	print(" **************************************************")
	print(" * Aligning version numbers (package -> program)...")
	
	bHasChanged = not doesVersionMatch()
	
	# Debug version will not increment the build number
	# to avoid new compile if nothing changed...
	if strEnv.endswith("_debug"):
		print(' * - debug version detected... ')
	else:
		print(' * > incrementing build number...')
		oVersion["build"] = oVersion["build"] + 1
		bHasChanged = True

	if(bHasChanged):
		print(" * > writing changes...")
		# Write the version file out... either with new build number, or corrected major/minor/patch
		with open(VERSION_FILE, 'w') as oFP:
			# "Version: {oVersion['major']}.{oVersion['minor']}.{oVersion['patch']}.{oVersion['build'}")
			print(f' * = New version: {getVersionStringOf(oVersion)}')
			print(oVersion)	
			json.dump(oVersion,oFP,indent=4)
			oFP.close()
			writeVersionIncludeFile(oVersion)
			forceToCompileMain()

	print(" **************************************************")
	print(f' * Using application version: {getVersionStringOf(oVersion)}')
	print(" **************************************************")

print("---------------------------------------------------------------")
print("ESP build script for PlatformIO (c) LSC-Labs 2024 - P.Liebl" )
print(" - increments the build number in version and include file")
print(" - stores the firmware file after building the bin.")



# Default Version Object - if not exists
if not os.path.exists(VERSION_FILE):
	print(f' A - creating default json version file: "{VERSION_FILE}"')
	Path(VERSION_FILE).parent.mkdir(exist_ok=True, parents=True)
	with open(VERSION_FILE, "w+") as oFP:
		json.dump(oDefaultVersion,oFP,indent=4)
		oFP.close()

# Default Version Include File - if not exists
if not os.path.exists(INCLUDE_FILE):
	print(f' A - creating default version include file: "{INCLUDE_FILE}"')
	writeVersionIncludeFile(oDefaultVersion)

if (os.path.exists(VERSION_FILE)):
	with open(VERSION_FILE, 'r') as oFP:
		oVersion = json.load(oFP)
		oFP.close()
	
if os.path.exists(PACKAGE_FILE):
	with open(PACKAGE_FILE, 'r') as oFP:
		oPackageFile = json.load(oFP)
		oFP.close()

if (not doesVersionMatch()): 
   print(' * > versions does not match (forcing new compile)')
   forceToCompileMain()
else:
   print(' * > found matching versions')


print("---------------------------------------------------------------")


# Register Pre and Post build functions
# Pre will be triggered by main.cpp compiler.
env.AddPostAction("buildprog", after_build)
env.AddPreAction("$BUILD_DIR/src/main.cpp.o", before_build)

