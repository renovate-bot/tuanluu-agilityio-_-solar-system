# TokenEconomizer Installation Design

## Intent

Install Microsoft's TokenEconomizer as a GitHub Copilot CLI plugin and use it while working in
this Solar System Explorer repository, so it can learn repository-specific facts and reduce
repeated token/tool costs across sessions.

## Goals and non-goals

- Keep the plugin clone outside this project repository to avoid a nested Git checkout.
- Register and install the plugin in Copilot CLI, then verify its installed status.
- Preserve existing workspace changes.
- Do not modify application dependencies or source code.
- Do not run the plugin's in-session setup commands without the user's approval in Copilot.

## Approaches

1. **Install from a persistent local clone (chosen):** clone to `%USERPROFILE%\TokenEconomizer`,
   register that path as a Copilot marketplace, and install the plugin. This follows the
   documented Copilot CLI workflow and keeps the plugin source available for updates.
2. Install directly from GitHub without a retained local clone. This is simpler, but conflicts
   with the project's documented workflow and makes the plugin's source/update location less
   explicit.
3. Wait for a compatibility confirmation. This avoids using an unverified CLI version but does
   not meet the immediate request.

## Constraints and risks

Python 3.14 meets TokenEconomizer's Python 3.10+ requirement. The installed Copilot CLI is
1.0.105, while TokenEconomizer currently lists 1.0.83–1.0.102 as tested; installation is
best-effort and runtime compatibility is not guaranteed. The plugin is installed in Copilot
CLI's user configuration, while its learned state is kept locally and separated by repository.
Tool pruning and loop guarding are enabled by default; tool pruning can later update this
repository's local Copilot settings and is reversible with the plugin's restore command.

## Acceptance

The clone exists at the chosen persistent path, Copilot CLI lists the TokenEconomizer marketplace
and enabled plugin, and no pre-existing workspace changes are overwritten. Runtime status and
tool-catalog initialization remain user-approved follow-up commands inside Copilot CLI.
