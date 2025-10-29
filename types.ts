
export interface GroundingChunk {
  web?: {
    uri: string;
    title: string;
  };
}

export interface HistoryItem {
  command: string;
  output: React.ReactNode;
  isProcessing?: boolean;
}
