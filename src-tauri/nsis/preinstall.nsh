; Kill running processes before install/reinstall to prevent file-lock errors
!macro NSIS_HOOK_PREINSTALL
  nsExec::ExecToLog 'taskkill /F /IM v-terminal.exe /T'
  Sleep 1000
!macroend

; Kill running processes before uninstall to prevent file-lock errors
!macro NSIS_HOOK_PREUNINSTALL
  nsExec::ExecToLog 'taskkill /F /IM v-terminal.exe /T'
  Sleep 1000
!macroend
