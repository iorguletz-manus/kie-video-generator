declare module 'peaks.js' {
  export interface PeaksOptions {
    containers: {
      overview?: HTMLElement;
      zoomview?: HTMLElement;
    };
    mediaElement: HTMLMediaElement;
    dataUri?: {
      json?: string;
      arraybuffer?: string;
    };
    webAudio?: {
      audioContext?: AudioContext;
      audioBuffer?: AudioBuffer;
      multiChannel?: boolean;
    };
    keyboard?: boolean;
    pointMarkerColor?: string;
    showPlayheadTime?: boolean;
    zoomLevels?: number[];
    segments?: Segment[];
    points?: Point[];
  }

  export interface Segment {
    id?: string;
    startTime: number;
    endTime: number;
    editable?: boolean;
    color?: string;
    labelText?: string;
    update(options: Partial<Segment>): void;
  }

  export interface Point {
    id?: string;
    time: number;
    editable?: boolean;
    color?: string;
    labelText?: string;
  }

  export interface PeaksInstance {
    destroy(): void;
    on(event: string, callback: (...args: any[]) => void): void;
    off(event: string, callback: (...args: any[]) => void): void;
    segments: {
      add(segment: Partial<Segment>): Segment;
      getSegments(): Segment[];
      getSegment(id: string): Segment | null;
      removeAll(): void;
      removeById(id: string): void;
    };
    points: {
      add(point: Partial<Point>): Point;
      getPoints(): Point[];
      getPoint(id: string): Point | null;
      removeAll(): void;
      removeById(id: string): void;
    };
    zoom: {
      zoomIn(): void;
      zoomOut(): void;
      setZoom(level: number): void;
      getZoom(): number;
    };
    player: {
      play(): void;
      pause(): void;
      seek(time: number): void;
      getCurrentTime(): number;
      getDuration(): number;
    };
  }

  export interface PeaksInitCallback {
    (error: Error | null, peaks: PeaksInstance | null): void;
  }

  export default class Peaks {
    static init(options: PeaksOptions, callback: PeaksInitCallback): void;
  }
}
