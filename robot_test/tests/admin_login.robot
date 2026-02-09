*** Settings ***
Resource    ../resources/keywords.robot

*** Test Cases ***
Valid Admin Login
    Open Application
    Admin Login
    Page Should Contain    Welcome
    Close Application
