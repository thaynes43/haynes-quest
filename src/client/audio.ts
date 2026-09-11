/** Approved mappings stay empty until exact-version owner review. */
export const approvedCues: Record<string, string> = {};
export class QuestAudio {
  private context: AudioContext | undefined;
  private disposed = false;
  private sources = new Set<AudioBufferSourceNode>();
  private gain: GainNode | undefined;
  private muted = true;
  private volume = 0.45;
  constructor() {
    try {
      const p = JSON.parse(localStorage.getItem("quest-audio") ?? "{}");
      this.muted = p.muted !== false;
      this.volume =
        typeof p.volume === "number"
          ? Math.max(0, Math.min(1, p.volume))
          : 0.45;
    } catch {
      /* Storage is optional. */
    }
  }
  preferences() {
    return { muted: this.muted, volume: this.volume };
  }
  setPreferences(muted: boolean, volume = this.volume) {
    this.muted = muted;
    this.volume = Math.max(0, Math.min(1, volume));
    if (this.gain) this.gain.gain.value = muted ? 0 : this.volume;
    try {
      localStorage.setItem("quest-audio", JSON.stringify(this.preferences()));
    } catch {
      /* Storage is optional. */
    }
  }
  async start() {
    if (this.disposed || !Object.keys(approvedCues).length) return;
    try {
      this.context ??= new AudioContext();
      this.gain ??= this.context.createGain();
      this.gain.gain.value = this.muted ? 0 : this.volume;
      this.gain.connect(this.context.destination);
      await this.context.resume();
    } catch {
      /* Audio never gates play. */
    }
  }
  suspend() {
    this.sources.forEach((s) => s.stop());
    this.sources.clear();
    void this.context?.suspend();
  }
  async cue(id: string) {
    if (
      this.disposed ||
      this.muted ||
      !this.context ||
      !this.gain ||
      !approvedCues[id] ||
      this.context.state !== "running"
    )
      return;
    try {
      const response = await fetch(approvedCues[id]);
      if (!response.ok) return;
      const buffer = await this.context.decodeAudioData(
        await response.arrayBuffer(),
      );
      if (this.disposed || this.muted || this.context.state !== "running")
        return;
      const s = this.context.createBufferSource();
      s.buffer = buffer;
      s.connect(this.gain);
      this.sources.add(s);
      s.onended = () => this.sources.delete(s);
      s.start();
    } catch {
      /* Visual cues remain. */
    }
  }
  dispose() {
    this.disposed = true;
    this.suspend();
    void this.context?.close();
  }
}
