# joao-mods

Marketplace local de mods do Claude Code: `status-sessao`, `sub-agents` e `replay-theater`. O `replay-theater` é uma cópia do mod de `anthropics/claude-code-playground`, alterada para não esconder a banda do `status-sessao`.

Também uso dois mods de terceiros, que não estão neste repo: Blast Radius (de `anthropics/claude-code-playground`) e Cache Tax (de `karanb192/claude-code-mods`). Os passos abaixo instalam tudo.

## Instalar em outra máquina

Clone este repo e o playground para a pasta de marketplaces locais. O Cache Tax não precisa de clone, porque o marketplace dele é lido direto do GitHub.

Linux:

```
git clone https://github.com/joaodecarv/joao-mods.git ~/.claude/local-marketplaces/joao-mods
git clone https://github.com/anthropics/claude-code-playground.git ~/.claude/local-marketplaces/claude-code-playground
```

Windows (PowerShell):

```
git clone https://github.com/joaodecarv/joao-mods.git "$env:USERPROFILE\.claude\local-marketplaces\joao-mods"
git clone https://github.com/anthropics/claude-code-playground.git "$env:USERPROFILE\.claude\local-marketplaces\claude-code-playground"
```

Depois junte isto ao `~/.claude/settings.json`. Troque `<HOME>` pelo seu diretório: `/home/joao` no Linux, ou `C:/Users/<você>` no Windows (com barras `/`).

```json
"extraKnownMarketplaces": {
  "joao-mods": {
    "source": { "source": "directory", "path": "<HOME>/.claude/local-marketplaces/joao-mods" }
  },
  "claude-code-playground-mods": {
    "source": { "source": "directory", "path": "<HOME>/.claude/local-marketplaces/claude-code-playground/claude-code/mods" }
  },
  "claude-code-mods": {
    "source": { "source": "github", "repo": "karanb192/claude-code-mods" }
  }
},
"enabledPlugins": {
  "sub-agents@joao-mods": true,
  "status-sessao@joao-mods": true,
  "replay-theater@joao-mods": true,
  "blast-radius@claude-code-playground-mods": true,
  "cache-tax@claude-code-mods": true
}
```

Reinicie o Claude Code. Se algum plugin não aparecer, instale pelo `/plugin` em um terminal `claude`.

## Clawd no status-sessao

O `status-sessao` desenha o Clawd dançando no canto direito da barra. A dança e o chapéu são opções do plugin, editáveis no menu de config do `/plugin` ou no `settings.json`:

```json
"pluginConfigs": {
  "status-sessao@joao-mods": { "options": { "dance": "party", "hat": "tophat" } }
}
```

- `dance`: `random` (padrão), `wave`, `shuffle`, `sway`, `party`, `still`
- `hat`: `random` (padrão), `none`, `tophat`, `party`, `crown`, `cap`

Com `random`, cada sessão sorteia a sua.

## Sincronizar

Neste repo: `git pull` antes de mexer, `git commit` + `git push` depois. Para atualizar o playground, rode `git pull` no clone dele.
