Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "c:\My_Project\Jarvis"
WshShell.Run "cmd.exe /c npm run start:all", 0, False
