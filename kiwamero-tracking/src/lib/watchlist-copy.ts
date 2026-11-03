export function watchlistRemoveBody(template: string, player: string) {
  return template.split("{player}").join(player);
}
