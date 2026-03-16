export const PLAYERS: {
  didUserInteract: boolean;
  watchDurations: Record<string, number>;
  watchTimePercentages: Record<string, number>;
  playingPartIds: Record<string, true>;
  isAnyPartPlaying: boolean;
}
  = $state({
    didUserInteract: false,
    watchDurations: {}, // in seconds
    watchTimePercentages: {},
    playingPartIds: {},
    isAnyPartPlaying: false,
  });
