*** Settings ***
Library    SeleniumLibrary
Resource   variables.robot

*** Keywords ***
Open Application
    Open Browser    ${BASE_URL}    ${BROWSER}
    Maximize Browser Window

Close Application
    Close Browser

Student Login
    Go To    ${BASE_URL}/student-login
    Input Text    name=email    ${STUDENT_EMAIL}
    Input Text    name=password    ${STUDENT_PASSWORD}
    Click Button    xpath=//button[text()='Login']

Admin Login
    Go To    ${BASE_URL}/admin-login
    Input Text    name=email    ${ADMIN_EMAIL}
    Input Text    name=password    ${ADMIN_PASSWORD}
    Click Button    xpath=//button[text()='Login']

