' Pizza Day & Night — starts the print agent with no window at all.
'
' This is what Task Scheduler runs at logon. A .bat started directly would show
' a console window on the restaurant's screen for as long as it runs, which
' someone would eventually close; the third argument to Run (0) means hidden,
' and False means do not wait for it to finish.
'
' Everything the agent would have printed goes to agent.log next to this file.
' To watch it live instead, run start-print-agent.bat by hand.

Dim shell, here
Set shell = CreateObject("WScript.Shell")
here = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)

shell.CurrentDirectory = here
shell.Run """" & here & "\start-print-agent.bat""", 0, False
