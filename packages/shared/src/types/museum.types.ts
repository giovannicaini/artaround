// Museum types
export interface Museum {
  _id: string;
  name: string;
  description: string;
  location: MuseumLocation;
  images: string[];
  configFile?: string; // JSON config file path or content
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface MuseumLocation {
  address: string;
  city: string;
  country: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
}

export interface MuseumConfig {
  id: string;
  name: string;
  coverImage: string; // base64 or URL
  map: MuseumMap;
  locations: MuseumServices;
}

export interface MuseumMap {
  type: 'image' | '3d';
  imageUrl?: string; // base64 or URL
  dimensions: {
    width: number;
    height: number;
  };
  markers: MapMarker[];
}

export interface MapMarker {
  id: string;
  x: number;
  y: number;
  type: MarkerType;
  label?: string;
}

export enum MarkerType {
  ARTWORK = 'artwork',
  ENTRANCE = 'entrance',
  EXIT = 'exit',
  TOILETTE = 'toilette',
  BAR = 'bar',
  SHOP = 'shop',
  EMERGENCY_EXIT = 'emergency_exit',
  ELEVATOR = 'elevator',
  STAIRS = 'stairs',
  ACCESSIBILITY = 'accessibility'
}

export interface MuseumServices {
  entrance: string;
  ticketPrice?: string;
  services: string[];
  openingHours?: string;
}
