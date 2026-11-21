@echo off
setlocal
cd /d "%~dp0"
title Publier le jeu sur GitHub Pages

where git >nul 2>&1
if errorlevel 1 goto nogit

if not exist ".git" git init -b main >nul

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
git add -A
git commit -m "Mise a jour du jeu" >nul 2>&1
git branch -M main
echo.
echo Envoi vers GitHub (une fenetre de connexion peut s'ouvrir la premiere fois)...
git push -u origin main
if errorlevel 1 goto pusherr

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

