# Short commands for this worktree's Docker stack and local dev scripts.
# The Compose project name is the worktree directory name, normalized the same
# way Docker Compose does (lowercase, then drop every character outside
# [a-z0-9_-]). Run make from any worktree and it targets only that worktree.
#
#   make stack run
#   make stack-run

SHELL := powershell.exe
.SHELLFLAGS := -NoProfile -ExecutionPolicy Bypass -Command
.DEFAULT_GOAL := help

ROOT := $(abspath $(dir $(lastword $(MAKEFILE_LIST))))
empty :=
space := $(empty) $(empty)

SUPPORTED := stack del dev db
ifneq ($(filter $(firstword $(MAKECMDGOALS)),$(SUPPORTED)),)
  ARGS := $(wordlist 2,$(words $(MAKECMDGOALS)),$(MAKECMDGOALS))
  ifneq ($(ARGS),)
    $(eval .PHONY: $(ARGS))
    $(eval $(ARGS):;@exit 0)
  endif
endif

GOAL := $(subst $(space),-,$(ARGS))
PREP = $$ErrorActionPreference = 'Stop'; $$root = '$(ROOT)'; $$project = ((Split-Path -Leaf $$root).ToLower() -replace '[^a-z0-9_-]',''); if (-not $$project) { Write-Host 'Could not derive a Compose project name from this worktree.'; exit 1 }; function Invoke-Compose { $$all = @('compose','--project-directory',$$root,'--env-file',(Join-Path $$root '.env.local'),'-p',$$project) + $$args; & docker @all; if ($$LASTEXITCODE -ne 0) { exit $$LASTEXITCODE } }
DBPREP = $(PREP); $$envFile = Join-Path $$root '.env.local'; if (-not (Test-Path -LiteralPath $$envFile)) { Write-Host 'Missing .env.local.'; exit 1 }; $$match = Select-String -LiteralPath $$envFile -Pattern '^MONGODB_DB_NAME=(.+)$$' | Select-Object -First 1; if (-not $$match) { Write-Host 'Set MONGODB_DB_NAME in .env.local.'; exit 1 }; $$dbName = $$match.Matches[0].Groups[1].Value.Trim().Trim([char]34).Trim([char]39); if ($$dbName -notmatch '^[A-Za-z0-9_-]+$$') { Write-Host 'MONGODB_DB_NAME must contain only letters, numbers, underscores, and hyphens.'; exit 1 }

.PHONY: help project ps logs stack stack-run stack-stop stack-quit dev dev-reset del del-container del-volume db db-collections db-shell db-reset-auth db-reset-projects

help:
	@Write-Output 'Worktree commands. Hyphen form works too (make stack-stop).'
	@Write-Output ''
	@Write-Output '  make stack run            Start MongoDB and the dev server'
	@Write-Output '  make stack stop           Stop the dev server and MongoDB'
	@Write-Output '  make stack quit           Stop the stack and quit Docker Desktop'
	@Write-Output '  make dev reset            Stop the stack, then start it again'
	@Write-Output '  make del container        Remove this worktree MongoDB container; keep the data volume'
	@Write-Output '  make del volume CONFIRM=<project>   Remove this worktree MongoDB container and data volume'
	@Write-Output '  make db collections       List collections and document counts'
	@Write-Output '  make db shell             Open mongosh in this worktree MongoDB'
	@Write-Output '  make db reset-auth        Delete local authentication records (asks for the database name)'
	@Write-Output '  make db reset-projects    Delete local project records (asks for the database name)'
	@Write-Output '  make ps                   Show this worktree Compose containers'
	@Write-Output '  make logs                 Show recent MongoDB logs'
	@Write-Output '  make project              Print the Compose project name for this worktree'

project:
	@$(PREP); Write-Output $$project

ps:
	@$(PREP); Invoke-Compose ps -a

logs:
	@$(PREP); Invoke-Compose logs --tail 100 mongodb

stack:
	@& '$(MAKE)' --no-print-directory $(if $(GOAL),stack-$(GOAL),help)

stack-run:
	@& '$(ROOT)/scripts/dev.ps1'

stack-stop:
	@& '$(ROOT)/scripts/stop.ps1'

stack-quit:
	@& '$(ROOT)/scripts/stop.ps1' --docker-quit

dev:
	@& '$(MAKE)' --no-print-directory $(if $(GOAL),dev-$(GOAL),help)

dev-reset:
	@& '$(ROOT)/scripts/stop.ps1'; & '$(ROOT)/scripts/dev.ps1'

del:
	@& '$(MAKE)' --no-print-directory $(if $(GOAL),del-$(GOAL),help)

del-container:
	@$(PREP); Write-Output "Removing the MongoDB container for $$project. The data volume is kept."; Invoke-Compose down --remove-orphans

del-volume:
	@$(PREP); if ('$(CONFIRM)' -ne $$project) { Write-Host "Delete the $$project MongoDB data volume with: make del volume CONFIRM=$$project"; exit 1 }; Write-Output "Removing the MongoDB container and data volume for $$project."; Invoke-Compose down -v --remove-orphans

db:
	@& '$(MAKE)' --no-print-directory $(if $(GOAL),db-$(GOAL),help)

db-collections:
	@$(DBPREP); $$id = Invoke-Compose ps --status running -q mongodb; if (-not $$id) { Write-Host "MongoDB for $$project is not running. Start it with: make stack run"; exit 1 }; Invoke-Compose --progress quiet cp (Join-Path $$root 'scripts/mongo-collections.js') mongodb:/tmp/unarchive-mongo-collections.js | Out-Null; Write-Output ("project $$project database $$dbName"); Invoke-Compose exec -T -e ('MONGODB_DB_NAME=' + $$dbName) mongodb mongosh --quiet --host 127.0.0.1 --file /tmp/unarchive-mongo-collections.js

db-shell:
	@$(DBPREP); $$id = Invoke-Compose ps --status running -q mongodb; if (-not $$id) { Write-Host "MongoDB for $$project is not running. Start it with: make stack run"; exit 1 }; Invoke-Compose --progress quiet cp (Join-Path $$root 'scripts/mongo-shell.sh') mongodb:/tmp/unarchive-mongo-shell.sh | Out-Null; Invoke-Compose exec -e ('MONGODB_DB_NAME=' + $$dbName) mongodb bash /tmp/unarchive-mongo-shell.sh

db-reset-auth:
	@Set-Location -LiteralPath '$(ROOT)'; node --env-file=.env.local scripts/reset-auth.mjs; if ($$LASTEXITCODE -ne 0) { exit $$LASTEXITCODE }

db-reset-projects:
	@Set-Location -LiteralPath '$(ROOT)'; node --env-file=.env.local scripts/reset-projects.mjs; if ($$LASTEXITCODE -ne 0) { exit $$LASTEXITCODE }
