Param(
[Parameter(Mandatory=$false, Position = 0)]$commitmsg="ayyy"
)
function lazygit([string]$commitmsg="ayyy") {
    git add .
    git commit -a -m "$commitmsg"
    git push
}
lazygit($commitmsg)

