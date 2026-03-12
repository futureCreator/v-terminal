; Kill running processes before install/reinstall to prevent file-lock errors
!macro NSIS_HOOK_PREINSTALL
  nsExec::ExecToLog 'taskkill /F /IM v-terminal.exe /T'
  nsExec::ExecToLog 'taskkill /F /IM v-terminal-daemon.exe /T'
  Sleep 1000
!macroend
