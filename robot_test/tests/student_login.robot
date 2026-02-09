*** Settings ***
Resource    ../resources/keywords.robot

*** Test Cases ***
Valid Student Login
    Open Application
    Student Login
    Page Should Contain    Welcome
    Close Application
