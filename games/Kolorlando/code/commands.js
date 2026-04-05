/* This module keeps chat/console commands in one place so gameplay code does
not need to hardcode command strings inline every time a new command is added.
The command list can grow here while the rest of the game only provides the
actions each command should trigger. */

export const KOLORLANDO_COMMANDS = {
  debugmode: '/debugmode',
  flymode: '/flymode',
  spawn: '/spawn',
};

/* The command handler is created from injected actions so this file stays
decoupled from the rest of the game state. That makes it easy to reuse from
chat, debug consoles, or future admin tools without importing the full game. */
export function createCommandHandler({
  onToggleDebugMode,
  onToggleFlyMode,
  onSpawn,
} = {}) {
  return async function handleCommand(message) {
    const trimmedMessage = typeof message === 'string' ? message.trim() : '';
    const [commandName = '', ...args] = trimmedMessage.split(/\s+/);
    const normalizedCommand = commandName.toLowerCase();

    /* Each known command delegates to a single action owned by script.js.
    Returning true tells the chat UI that the message was consumed as a
    command and should not be treated like normal chat text. */
    if (normalizedCommand === KOLORLANDO_COMMANDS.debugmode) {
      onToggleDebugMode?.();
      return true;
    }

    if (normalizedCommand === KOLORLANDO_COMMANDS.flymode) {
      onToggleFlyMode?.();
      return true;
    }

    if (normalizedCommand === KOLORLANDO_COMMANDS.spawn) {
      await onSpawn?.(args);
      return true;
    }

    return false;
  };
}
