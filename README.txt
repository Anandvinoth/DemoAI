INSTALL GCloud in MAC , Install brew first
(base) e221137@dgslap5psmdw3 google-cloud-sdk % cd /Users/e221137/Official/personal/Demo/GCP/google-cloud-sdk
Run the Official Install Command:For macOS (Intel or Apple Silicon):
(base) e221137@dgslap5psmdw3 google-cloud-sdk % /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
Add Homebrew to Your PATH
(base) e221137@dgslap5psmdw3 google-cloud-sdk % eval "$(/opt/homebrew/bin/brew shellenv)"  
Verify Installation
(base) e221137@dgslap5psmdw3 google-cloud-sdk % brew --version
Make It Permanent (Only Once) - To ensure brew is always available, add it to your Zsh startup file:
echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
Install gcloud
brew install --cask google-cloud-sdk
After it installs, run:
gcloud init


Install Docker :
brew install --cask docker


git:
git --version
git init
git add README.txt
git commit -m "Initial commit"
Link to a remote GitHub repository
git remote add origin https://github.com/Anandvinoth/DemoAI.git
git push -u origin master