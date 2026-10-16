# joao-mods

Marketplace local de mods do Claude Code: `status-sessao` e `subagentes`.

## Instalar em outra máquina

Clone para a pasta de marketplaces locais:

```
git clone https://github.com/joaodecarv/joao-mods.git ~/.claude/local-marketplaces/joao-mods
```

No Windows (PowerShell):

```
git clone https://github.com/joaodecarv/joao-mods.git "$env:USERPROFILE\.claude\local-marketplaces\joao-mods"
```

Depois adicione ao `~/.claude/settings.json` (no Windows, use o caminho completo, ex. `C:/Users/<você>/.claude/local-marketplaces/joao-mods`):

```json
"extraKnownMarketplaces": {
  "joao-mods": {
    "source": { "source": "directory", "path": "/home/joao/.claude/local-marketplaces/joao-mods" }
  }
},
"enabledPlugins": {
  "subagentes@joao-mods": true,
  "status-sessao@joao-mods": true
}
```

## Sincronizar

`git pull` antes de mexer, `git commit` + `git push` depois.
