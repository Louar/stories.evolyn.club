export const PLAYERS: {
  didUserInteract: boolean;
  watchDurations: Record<string, number>;
  watchTimePercentages: Record<string, number>;
}
  = $state({
    didUserInteract: false,
    watchDurations: {}, // in seconds
    watchTimePercentages: {},
  });