@echo off
setlocal
cd /d "%~dp0"
title Publier le jeu sur GitHub Pages

where git >nul 2>&1
if errorlevel 1 goto nogit

if not exist ".git" git init -b main >nul

rem Les commits de ce depot sont toujours signes Zmar1 (jamais l'identite Git du travail)
git config user.name "Zmar1"
git config user.email "marwen1.zarrouki@gmail.com"

git remote get-url origin >nul 2>&1
if not errorlevel 1 goto push

echo.
echo ================== PREMIERE PUBLICATION ==================
echo  1. Va sur https://github.com/new  (cree un compte gratuit si besoin)
echo  2. Nom du depot : qalleb-el-karta   -  coche "Public"  -  "Create repository"
echo  3. Copie l'adresse du depot, par exemple :
echo     https://github.com/ton-pseudo/qalleb-el-karta.git
echo ==========================================================
echo.
set /p REPO=Colle l'adresse du depot ici puis appuie sur Entree :
if "%REPO%"=="" goto norepo
git remote add origin %REPO%
set FIRST=1

:push
rem Seule la branche "main" est publiee sur le site. Sur une autre branche (ex. phase1-supabase),
rem on sauvegarde seulement la branche sur GitHub : le site en ligne ne change pas.
set "BRANCH="
for /f "delims=" %%b in ('git symbolic-ref --short HEAD 2^>nul') do set "BRANCH=%%b"
if not defined BRANCH goto detached
if /i "%BRANCH%"=="master" goto publish
if /i not "%BRANCH%"=="main" goto savebranch

:publish
git add -A
git commit -m "Mise a jour du jeu" >nul 2>&1
git branch -M main
echo.
echo Envoi vers GitHub (une fenetre de connexion peut s'ouvrir la premiere fois)...
git push -u origin main
if not errorlevel 1 goto pushok

echo.
echo GitHub contient des changements absents d'ici : recuperation puis nouvel envoi...
git pull --no-rebase --allow-unrelated-histories --no-edit origin main
if errorlevel 1 goto pusherr
git push -u origin main
if errorlevel 1 goto pusherr

:pushok

echo.
echo ==========================================================
echo  OK ! Le jeu est envoye sur GitHub.
if defined FIRST (
  echo.
  echo  DERNIERE ETAPE, une seule fois :
  echo  Sur la page du depot : Settings - Pages
  echo  Source : "Deploy from a branch" - Branch : main / root - Save
  echo.
  echo  Le jeu sera en ligne dans 1 a 2 minutes sur :
  echo  https://ton-pseudo.github.io/qalleb-el-karta/
) else (
  echo  Le site se met a jour tout seul dans 1 a 2 minutes.
)
echo ==========================================================
pause
exit /b 0

:savebranch
echo.
echo ==========================================================
echo  Tu es sur la branche "%BRANCH%" et pas sur "main".
echo  Le site en ligne ne change PAS : seule "main" est publiee.
echo  Sauvegarde de la branche sur GitHub...
echo ==========================================================
git add -A
git commit -m "Travail en cours - %BRANCH%" >nul 2>&1
git push -u origin "%BRANCH%"
if errorlevel 1 goto pusherr
echo.
echo  OK ! Branche "%BRANCH%" sauvegardee sur GitHub. Le site n'a pas change.
echo  Revenir a la version en ligne : git checkout main
pause
exit /b 0

:detached
echo.
echo Aucune branche active : publication annulee.
echo Reviens sur une branche, par exemple : git checkout main
pause
exit /b 1

:nogit
echo Git n'est pas installe : https://git-scm.com/download/win
pause
exit /b 1

:norepo
echo Aucune adresse saisie, publication annulee.
pause
exit /b 1

:pusherr
echo.
echo L'envoi a echoue. Verifie l'adresse du depot et ta connexion GitHub.
echo Pour changer l'adresse : git remote set-url origin NOUVELLE_ADRESSE
pause
exit /b 1

