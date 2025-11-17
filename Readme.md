# ESP-Project Template

This template should ease the development of smart device applications that are running on small devices like the Esspriff family. In most samples you write a sketch to build a funktionality on this devices and you find out, that it is very easy to implement this functions. Next you try to get this device up and running, then you find out, that you need a lot of modules, like a WiFi connection, an message broker or a possibility to udpate this devices.
In principle, these functions are also easy to implement and very time consumint, cause you have to implement and learn a lot of things.

This is, where this template comes in place. The template is using the ESP-Runtime PLibESPV1 which offers a application functionality and organize the development in "modules", so you can use the existing modules and plug in your own modules or replace existing one.

As soon as a modules are defined, they can be reused and you don't have to worry about how to display and configure them with web pages. Also a simple to use security module is available, so you don't have to think a lot about Authentications or Authorization for user and administrator functionalities.

What you have to do to get a smart device with a Web GUI:
- write your module with the functionality
- select the modules you want to use in your application
- compile and test


## Quick start...
To ease the startup, after cloning this template, you can use the script "initialize".
This script will register the submodules(with the PLibEspV1 application framework) that are used.
Second it checks out all necessary modules, like gulp for the current development process.

Next edit the src/web/settings.js file.
- Insert your program name, version number and the web pages you want to use in your device. This file is for the usage in the Web GUI.
- Also edit the data/prog_version.json file and insert the progname and the version inside - this file is used for the info in the cpp part - in the device.

Next check the file pages.json. This file contains a list of files, that you want to use in your application (sync.files).
- The stylesheets from the runtime will be updated in your folders (src/web/css), also as the needed javascript files.

Also the pages / modules you want to use in your application are inside this file, like WiFi or Device Management like OTA functioniality.

After setting up this files, use the "sync-Files" and the "build-Pages" npm functions. If you are using Visual Code as editor, you can start these scripts in the section "NPM SCRIPTS". These script can be started again, if you changed some modules and you need an update.

