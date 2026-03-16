export const PLAYERS: {
  didUserInteract: boolean;
  watchDurations: Record<string, number>;
  watchTimePercentages: Record<string, number>;
  isAnyPartPlaying: boolean;
  isAnyOverlayActive: boolean;
}
  = $state({
    didUserInteract: false,
    watchDurations: {}, // in seconds
    watchTimePercentages: {},
    isAnyPartPlaying: false,
    isAnyOverlayActive: false,
  });
