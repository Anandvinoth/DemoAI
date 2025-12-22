export JAVA_HOME=$(/usr/libexec/java_home -v 17)
export PATH=$JAVA_HOME/bin:$PATH

# Created by `pipx` on 2024-12-09 19:14:51
export PATH="$PATH:/Users/e221137/.local/bin"


# Load Angular CLI autocompletion.
#source <(ng completion script)

export PATH="/opt/homebrew/bin:$PATH"
eval "$(pyenv init --path)"
eval "$(pyenv init -)"

# >>> conda initialize >>>
# !! Contents within this block are managed by 'conda init' !!
__conda_setup="$('/Users/e221137/anaconda3/bin/conda' 'shell.zsh' 'hook' 2> /dev/null)"
if [ $? -eq 0 ]; then
    eval "$__conda_setup"
else
    if [ -f "/Users/e221137/anaconda3/etc/profile.d/conda.sh" ]; then
        . "/Users/e221137/anaconda3/etc/profile.d/conda.sh"
    else
        export PATH="/Users/e221137/anaconda3/bin:$PATH"
    fi
fi
unset __conda_setup
# <<< conda initialize <<<

