import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, MapPin, Clock, ChevronRight, Menu, X, Loader2, Map as MapIcon, ExternalLink, Play, Volume2, VolumeX } from 'lucide-react';
import { Era } from './types';
import seedData from './seedData.json';
import { generateMemoir } from './services/geminiService';

// Mock Google Maps Autocomplete since we don't have a real API key in this environment
// In a real app, we'd use the Google Maps JS API
const useGoogleAutocomplete = (inputRef: React.RefObject<HTMLInputElement | null>) => {
  const [prediction, setPrediction] = useState<string | null>(null);

  useEffect(() => {
    if (!inputRef.current) return;
    // Real implementation would attach google.maps.places.Autocomplete here
  }, [inputRef]);

  return prediction;
};

function VideoModal({ videoUrl, onClose }: { videoUrl: string, onClose: () => void }) {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md p-4"
      onClick={onClose}
    >
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="relative w-full max-w-5xl aspect-video bg-zinc-900 rounded-2xl overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <video 
          src={videoUrl} 
          autoPlay 
          controls 
          className="w-full h-full object-contain"
        />
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-2 bg-black/50 rounded-full text-white hover:bg-black/70 transition-colors z-10"
        >
          <X size={24} />
        </button>
      </motion.div>
    </motion.div>
  );
}

function MapView({ searchQuery, eras, onPlayVideo }: { searchQuery: string, eras: Era[], onPlayVideo: (url: string) => void }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [activeMarkerEra, setActiveMarkerEra] = useState<Era | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedEraId, setSelectedEraId] = useState<string>('all');
  const markersRef = useRef<google.maps.Marker[]>([]);
  const [center, setCenter] = useState<google.maps.LatLng | null>(null);

  useEffect(() => {
    if (!mapRef.current || !window.google) return;

    const geocoder = new google.maps.Geocoder();
    geocoder.geocode({ address: searchQuery }, (results, status) => {
      if (status === 'OK' && results && results[0]) {
        setError(null);
        const newCenter = results[0].geometry.location;
        setCenter(newCenter);
        
        const newMap = new google.maps.Map(mapRef.current!, {
          center: newCenter,
          zoom: 15,
          styles: [
            { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
            { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
            { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
            {
              featureType: "administrative.locality",
              elementType: "labels.text.fill",
              stylers: [{ color: "#d59563" }],
            },
            {
              featureType: "poi",
              elementType: "labels.text.fill",
              stylers: [{ color: "#d59563" }],
            },
            {
              featureType: "poi.park",
              elementType: "geometry",
              stylers: [{ color: "#263c3f" }],
            },
            {
              featureType: "poi.park",
              elementType: "labels.text.fill",
              stylers: [{ color: "#6b9a76" }],
            },
            {
              featureType: "road",
              elementType: "geometry",
              stylers: [{ color: "#38414e" }],
            },
            {
              featureType: "road",
              elementType: "geometry.stroke",
              stylers: [{ color: "#212a37" }],
            },
            {
              featureType: "road",
              elementType: "labels.text.fill",
              stylers: [{ color: "#9ca5b3" }],
            },
            {
              featureType: "road.highway",
              elementType: "geometry",
              stylers: [{ color: "#746855" }],
            },
            {
              featureType: "road.highway",
              elementType: "geometry.stroke",
              stylers: [{ color: "#1f2835" }],
            },
            {
              featureType: "road.highway",
              elementType: "labels.text.fill",
              stylers: [{ color: "#f3d19c" }],
            },
            {
              featureType: "transit",
              elementType: "geometry",
              stylers: [{ color: "#2f3948" }],
            },
            {
              featureType: "transit.station",
              elementType: "labels.text.fill",
              stylers: [{ color: "#d59563" }],
            },
            {
              featureType: "water",
              elementType: "geometry",
              stylers: [{ color: "#17263c" }],
            },
            {
              featureType: "water",
              elementType: "labels.text.fill",
              stylers: [{ color: "#515c6d" }],
            },
            {
              featureType: "water",
              elementType: "labels.text.stroke",
              stylers: [{ color: "#17263c" }],
            },
          ],
          disableDefaultUI: true,
          zoomControl: true,
        });

        setMap(newMap);
      } else {
        console.error('Geocoding failed:', status);
        if (status === 'REQUEST_DENIED') {
          setError('The Geocoding API is not enabled in your Google Cloud project. Please enable it in the Google Cloud Console.');
        } else {
          setError(`Geocoding failed: ${status}`);
        }
      }
    });
  }, [searchQuery]);

  // Handle markers separately
  useEffect(() => {
    if (!map || !center) return;

    // Clear existing markers
    markersRef.current.forEach(marker => marker.setMap(null));
    markersRef.current = [];

    const filteredEras = selectedEraId === 'all' 
      ? eras 
      : eras.filter(e => e.id === selectedEraId);

    filteredEras.forEach((era) => {
      const position = era.coordinates 
        ? new google.maps.LatLng(era.coordinates.lat, era.coordinates.lng)
        : new google.maps.LatLng(
            center.lat() + (Math.random() - 0.5) * 0.002, 
            center.lng() + (Math.random() - 0.5) * 0.002
          );

      const marker = new google.maps.Marker({
        position,
        map: map,
        title: era.title,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          fillColor: '#f59e0b',
          fillOpacity: 0.8,
          strokeColor: '#ffffff',
          strokeWeight: 2,
          scale: 10,
        },
        animation: google.maps.Animation.DROP,
      });

      marker.addListener('click', () => {
        setActiveMarkerEra(era);
      });

      markersRef.current.push(marker);
    });
  }, [map, center, eras, selectedEraId]);

  useEffect(() => {
    if (!map) return;

    if (activeMarkerEra && activeMarkerEra.coordinates) {
      const position = new google.maps.LatLng(activeMarkerEra.coordinates.lat, activeMarkerEra.coordinates.lng);
      map.panTo(position);
      map.setZoom(17);
    } else if (!activeMarkerEra) {
      // Zoom out slightly when closing the detail view
      // We don't want to zoom out too far, maybe back to 15
      const currentZoom = map.getZoom();
      if (currentZoom && currentZoom > 15) {
        map.setZoom(15);
      }
    }
  }, [activeMarkerEra, map]);

  return (
    <div className="h-screen w-full relative bg-zinc-900">
      <div ref={mapRef} className="w-full h-full" />

      {/* Era Filter UI */}
      <div className="absolute top-8 left-8 z-20 flex flex-col gap-2">
        <div className="bg-zinc-950/90 backdrop-blur-md border border-white/10 p-4 rounded-2xl shadow-2xl w-64">
          <div className="flex items-center gap-2 mb-3 text-amber-500">
            <Clock size={16} />
            <span className="text-[10px] uppercase tracking-widest font-bold">Filter by Era</span>
          </div>
          <select 
            value={selectedEraId}
            onChange={(e) => setSelectedEraId(e.target.value)}
            className="w-full bg-zinc-900 border border-white/5 rounded-lg px-3 py-2 text-sm text-zinc-300 focus:outline-none focus:ring-1 focus:ring-amber-500/50 appearance-none cursor-pointer"
          >
            <option value="all">All Eras</option>
            {eras.map(era => (
              <option key={era.id} value={era.id}>{era.title}</option>
            ))}
          </select>
        </div>
      </div>
      
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-zinc-900/80 backdrop-blur-sm z-30 p-8">
          <div className="bg-zinc-950 border border-red-500/30 p-8 rounded-2xl max-w-lg shadow-2xl">
            <h3 className="text-red-500 font-bold mb-4 flex items-center gap-2">
              <X className="border border-red-500 rounded-full p-0.5" size={18} />
              Map Service Error
            </h3>
            <p className="text-zinc-300 text-sm leading-relaxed mb-6">
              {error}
            </p>
            <div className="space-y-4">
              <p className="text-xs text-zinc-500 uppercase tracking-widest font-bold">How to fix:</p>
              <ol className="text-xs text-zinc-400 space-y-2 list-decimal list-inside">
                <li>Go to the <a href="https://console.cloud.google.com/apis/library/geocoding-backend.googleapis.com" target="_blank" rel="noopener noreferrer" className="text-amber-500 hover:underline">Google Cloud Console</a>.</li>
                <li>Ensure the <strong>Geocoding API</strong> is enabled for your project.</li>
                <li>Also ensure the <strong>Maps JavaScript API</strong> is enabled.</li>
                <li>Refresh this page once the APIs are activated.</li>
              </ol>
            </div>
          </div>
        </div>
      )}

      <AnimatePresence>
        {activeMarkerEra && (
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="absolute top-8 right-8 z-20 w-80 bg-zinc-950/95 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl"
          >
            <div className="relative aspect-video bg-zinc-900">
              <img 
                src={activeMarkerEra.imageUrl} 
                alt={activeMarkerEra.title} 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
              <button 
                onClick={() => setActiveMarkerEra(null)}
                className="absolute top-2 right-2 p-1 bg-black/50 rounded-full text-white hover:bg-black/70 transition-colors z-10"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-6">
              <div className="text-[10px] uppercase tracking-widest text-amber-500 font-bold mb-1">
                {activeMarkerEra.title}
              </div>
              <h4 className="font-serif text-xl text-zinc-100 mb-3 italic">
                "{activeMarkerEra.pullQuote}"
              </h4>
              <p className="text-sm text-zinc-400 line-clamp-4 leading-relaxed mb-4">
                {activeMarkerEra.monologue}
              </p>

              {activeMarkerEra.videoUrl && (
                <div className="mb-6">
                  <h5 className="text-[9px] uppercase tracking-[0.2em] text-zinc-500 mb-2 font-bold flex items-center gap-1">
                    <Play size={10} />
                    Cinematic Memory
                  </h5>
                  <button 
                    onClick={() => onPlayVideo(activeMarkerEra.videoUrl!)}
                    className="relative w-full aspect-video rounded-lg overflow-hidden group/vid border border-white/5"
                  >
                    <img 
                      src={activeMarkerEra.imageUrl} 
                      className="w-full h-full object-cover opacity-60 group-hover/vid:scale-110 transition-transform duration-500"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover/vid:bg-black/40 transition-colors">
                      <div className="w-10 h-10 rounded-full bg-amber-500 flex items-center justify-center text-black shadow-lg scale-90 group-hover/vid:scale-100 transition-transform">
                        <Play size={20} fill="currentColor" />
                      </div>
                    </div>
                  </button>
                </div>
              )}

              {activeMarkerEra.mapLinks && activeMarkerEra.mapLinks.length > 0 && (
                <div className="mb-6">
                  <h5 className="text-[9px] uppercase tracking-[0.2em] text-zinc-500 mb-2 font-bold flex items-center gap-1">
                    <ExternalLink size={10} />
                    Historical Grounding
                  </h5>
                  <div className="space-y-1.5">
                    {activeMarkerEra.mapLinks.map((link, lIdx) => (
                      <a 
                        key={lIdx}
                        href={link.uri}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between group/link px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/5 rounded-lg text-[11px] text-zinc-300 transition-all"
                      >
                        <span className="truncate pr-2">{link.title}</span>
                        <ChevronRight size={10} className="text-zinc-600 group-hover/link:text-amber-500 transition-colors" />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              <button 
                onClick={() => {
                  const element = document.getElementById(activeMarkerEra.id);
                  if (element) {
                    // Switch back to memoir view and scroll
                    // This requires lifting state or using a ref, but for now we can just close
                    setActiveMarkerEra(null);
                    // In a real app we'd trigger the tab switch here
                  }
                }}
                className="w-full py-2 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 rounded-lg text-amber-500 text-xs font-bold transition-all"
              >
                Read Full Memoir
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="absolute top-8 left-8 z-10 flex flex-col gap-4 pointer-events-none">
        <div className="bg-zinc-950/90 backdrop-blur-md p-6 border border-white/10 rounded-xl max-w-md pointer-events-auto">
          <h3 className="font-serif text-2xl text-amber-500 mb-2 italic">Geographic Memory</h3>
          <p className="text-sm text-zinc-400 leading-relaxed">
            Click on the amber markers to hear the echoes of the past at this location. 
            Each point represents a different era in the life of <span className="text-zinc-200 font-bold">{searchQuery}</span>.
          </p>
        </div>
      </div>
    </div>
  );
}

function CinematicView({ searchQuery }: { searchQuery: string }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  return (
    <div className="h-screen w-full bg-black flex items-center justify-center relative overflow-hidden">
      <video 
        ref={videoRef}
        autoPlay 
        loop 
        muted 
        playsInline
        className="absolute inset-0 w-full h-full object-cover opacity-60 transition-opacity duration-1000"
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
      >
        <source src="https://assets.mixkit.co/videos/preview/mixkit-chicago-city-skyline-at-night-4687-large.mp4" type="video/mp4" />
      </video>
      
      <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black opacity-80" />
      
      {/* Cinematic Overlays */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="h-full w-full flex flex-col justify-between p-12 md:p-24">
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.5, delay: 0.5 }}
            className="flex justify-between items-start"
          >
            <div className="flex flex-col gap-2">
              <span className="text-[10px] uppercase tracking-[0.4em] text-amber-500/60 font-bold">Chronicle</span>
              <h3 className="font-serif text-3xl text-amber-50 italic">Cinematic Walkthrough</h3>
            </div>
            <div className="text-right">
              <span className="text-[10px] uppercase tracking-[0.4em] text-zinc-500 font-bold">Status</span>
              <div className="flex items-center gap-2 justify-end">
                <div className={`w-1.5 h-1.5 rounded-full ${isPlaying ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-600'}`} />
                <span className="text-[10px] uppercase tracking-widest text-zinc-400">{isPlaying ? 'Live Feed' : 'Paused'}</span>
              </div>
            </div>
          </motion.div>

          <div className="flex flex-col items-center gap-8 pointer-events-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 2, ease: "easeOut" }}
              className="text-center"
            >
              <h2 className="font-serif text-7xl md:text-9xl text-amber-500 italic mb-4 drop-shadow-[0_0_30px_rgba(245,158,11,0.3)]">
                {searchQuery}
              </h2>
              <p className="text-zinc-400 text-sm md:text-base uppercase tracking-[0.8em] font-light">
                A Journey Through the Ages
              </p>
            </motion.div>

            <button 
              onClick={togglePlay}
              className="group flex flex-col items-center gap-4 transition-all"
            >
              <div className="w-16 h-16 rounded-full border border-amber-500/30 flex items-center justify-center bg-black/40 backdrop-blur-md group-hover:bg-amber-500 group-hover:text-black transition-all duration-500">
                {isPlaying ? <X size={24} /> : <Play size={24} fill="currentColor" className="ml-1" />}
              </div>
              <span className="text-[10px] uppercase tracking-[0.3em] text-amber-500 font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                {isPlaying ? 'Pause Experience' : 'Begin Walkthrough'}
              </span>
            </button>
          </div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.5, delay: 1 }}
            className="flex justify-between items-end"
          >
            <div className="flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-[0.3em] text-zinc-500">Location Coordinates</span>
              <span className="text-xs uppercase tracking-widest text-amber-500 font-bold">{searchQuery} • 41.8781° N, 87.6298° W</span>
            </div>
            <div className="text-right flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-[0.3em] text-zinc-500">Temporal Phase</span>
              <span className="text-xs uppercase tracking-widest text-amber-500 font-bold">Multidimensional Evolution</span>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Cinematic Letterboxing */}
      <div className="absolute top-0 left-0 w-full h-16 bg-black z-20" />
      <div className="absolute bottom-0 left-0 w-full h-16 bg-black z-20" />
    </div>
  );
}

interface Song {
  id: string;
  title: string;
  artist: string;
  category: 'About Chicago' | 'By Chicago Artists' | 'Made in Chicago';
  videoId: string;
}

const CHICAGO_SOUNDTRACK: Song[] = [
  { id: 'sirius', title: 'Sirius', artist: 'The Alan Parsons Project', category: 'About Chicago', videoId: 'yCR85u9QngQ' },
  { id: 'sweet-home', title: 'Sweet Home Chicago', artist: 'The Blues Brothers', category: 'About Chicago', videoId: '79vCiX93CIY' },
  { id: 'chicago-sufjan', title: 'Chicago', artist: 'Sufjan Stevens', category: 'About Chicago', videoId: 'c_-cUdmdWG0' },
  { id: 'homecoming', title: 'Homecoming', artist: 'Kanye West', category: 'By Chicago Artists', videoId: 'LQ488QrqVI4' },
  { id: 'my-kind-of-town', title: 'My Kind of Town', artist: 'Frank Sinatra', category: 'About Chicago', videoId: '2n6v966L06A' },
  { id: 'lsd', title: 'Lake Shore Drive', artist: 'Aliotta Haynes Jeremiah', category: 'Made in Chicago', videoId: '0S13mP_pzeQ' },
  { id: 'chicago-25', title: '25 or 6 to 4', artist: 'Chicago', category: 'By Chicago Artists', videoId: '7uAUoz7jimg' },
];

function MusicControl({ currentSong, isPlaying, onOpenModal }: { 
  currentSong: Song, 
  isPlaying: boolean, 
  onOpenModal: () => void 
}) {
  return (
    <div className="fixed bottom-8 right-8 z-[60] flex items-center gap-4">
      <AnimatePresence>
        {isPlaying && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="bg-zinc-950/90 backdrop-blur-md border border-white/10 px-4 py-2 rounded-full hidden md:flex items-center gap-3"
          >
            <div className="flex flex-col">
              <span className="text-[9px] uppercase tracking-widest text-amber-500 font-bold">Now Playing</span>
              <span className="text-xs text-zinc-100 truncate max-w-[120px]">{currentSong.title}</span>
            </div>
            <div className="flex gap-1 h-3 items-end">
              {[1, 2, 3, 4].map(i => (
                <motion.div
                  key={i}
                  animate={{ height: [4, 12, 6, 10, 4] }}
                  transition={{ duration: 1, repeat: Infinity, delay: i * 0.1 }}
                  className="w-0.5 bg-amber-500"
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={onOpenModal}
        className={`group relative p-4 rounded-full bg-zinc-950/90 border border-white/10 text-zinc-400 hover:text-amber-500 hover:border-amber-500/50 transition-all duration-300 shadow-2xl`}
      >
        {isPlaying ? <Volume2 size={20} /> : <VolumeX size={20} />}
      </button>
    </div>
  );
}

function MusicModal({ isOpen, onClose, currentSong, isPlaying, onSelectSong, onTogglePlay }: {
  isOpen: boolean,
  onClose: () => void,
  currentSong: Song,
  isPlaying: boolean,
  onSelectSong: (song: Song) => void,
  onTogglePlay: () => void
}) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="bg-zinc-950 border border-white/10 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-8 border-b border-white/5 flex justify-between items-center bg-zinc-900/50">
              <div>
                <h2 className="font-serif text-3xl text-amber-500 italic">Chicago Soundscape</h2>
                <p className="text-xs text-zinc-500 uppercase tracking-widest mt-1">The rhythm of the city</p>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full text-zinc-500 transition-colors">
                <X size={24} />
              </button>
            </div>

            <div className="p-8 max-h-[60vh] overflow-y-auto custom-scrollbar">
              <div className="grid gap-4">
                {CHICAGO_SOUNDTRACK.map(song => (
                  <button
                    key={song.id}
                    onClick={() => onSelectSong(song)}
                    className={`flex items-center justify-between p-4 rounded-2xl border transition-all group ${
                      currentSong.id === song.id 
                        ? 'bg-amber-500/10 border-amber-500/30' 
                        : 'bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/10'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${
                        currentSong.id === song.id ? 'bg-amber-500 text-black' : 'bg-zinc-900 text-zinc-500 group-hover:text-amber-500'
                      }`}>
                        {currentSong.id === song.id && isPlaying ? (
                          <div className="flex gap-1 h-4 items-end">
                            {[1, 2, 3].map(i => (
                              <motion.div
                                key={i}
                                animate={{ height: [4, 16, 8, 12, 4] }}
                                transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.1 }}
                                className="w-0.5 bg-current"
                              />
                            ))}
                          </div>
                        ) : (
                          <Play size={20} fill={currentSong.id === song.id ? "currentColor" : "none"} />
                        )}
                      </div>
                      <div className="text-left">
                        <h4 className={`font-bold text-sm ${currentSong.id === song.id ? 'text-amber-500' : 'text-zinc-100'}`}>
                          {song.title}
                        </h4>
                        <p className="text-xs text-zinc-500">{song.artist}</p>
                      </div>
                    </div>
                    <span className="text-[9px] uppercase tracking-widest text-zinc-600 font-bold bg-white/5 px-2 py-1 rounded-md">
                      {song.category}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="p-8 bg-zinc-900/50 border-t border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-amber-500 flex items-center justify-center text-black">
                  <Volume2 size={20} />
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-amber-500 font-bold">Now Playing</p>
                  <p className="text-sm text-zinc-100">{currentSong.title}</p>
                </div>
              </div>
              <button
                onClick={onTogglePlay}
                className="px-6 py-2 bg-amber-500 hover:bg-amber-400 text-black rounded-full text-xs font-bold transition-all"
              >
                {isPlaying ? "Pause" : "Play"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function ChicagoSoundtrack({ 
  currentSong, 
  setCurrentSong, 
  isMusicPlaying, 
  setIsMusicPlaying, 
  isModalOpen, 
  setIsModalOpen 
}: {
  currentSong: Song,
  setCurrentSong: (song: Song) => void,
  isMusicPlaying: boolean,
  setIsMusicPlaying: (playing: boolean) => void,
  isModalOpen: boolean,
  setIsModalOpen: (open: boolean) => void
}) {
  return (
    <>
      <MusicControl 
        currentSong={currentSong}
        isPlaying={isMusicPlaying}
        onOpenModal={() => setIsModalOpen(true)}
      />
      <MusicModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        currentSong={currentSong}
        isPlaying={isMusicPlaying}
        onSelectSong={(song) => {
          setCurrentSong(song);
          setIsMusicPlaying(true);
        }}
        onTogglePlay={() => setIsMusicPlaying(!isMusicPlaying)}
      />
      <div className="fixed -top-[1000px] left-0 pointer-events-none opacity-0">
        {isMusicPlaying && (
          <iframe
            width="100"
            height="100"
            src={`https://www.youtube.com/embed/${currentSong.videoId}?autoplay=1&loop=1&playlist=${currentSong.videoId}`}
            allow="autoplay"
          />
        )}
      </div>
    </>
  );
}

export default function App() {
  const [view, setView] = useState<'landing' | 'loading' | 'memoir'>('landing');
  const [activeTab, setActiveTab] = useState<'memoir' | 'map' | 'cinematic'>('memoir');
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingText, setLoadingText] = useState('Searching the archives...');
  const [eras, setEras] = useState<Era[]>([]);
  const [activeEra, setActiveEra] = useState(0);
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);
  const [isMusicPlaying, setIsMusicPlaying] = useState(false);
  const [currentSong, setCurrentSong] = useState<Song>(CHICAGO_SOUNDTRACK[0]);
  const [isMusicModalOpen, setIsMusicModalOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleFirstClick = () => {
      setIsMusicPlaying(true);
      document.removeEventListener('click', handleFirstClick);
    };
    document.addEventListener('click', handleFirstClick);
    return () => document.removeEventListener('click', handleFirstClick);
  }, []);

  const loadingPhrases = [
    "Searching the archives...",
    "Listening to the street corners...",
    "The building is remembering..."
  ];

  useEffect(() => {
    if (view === 'loading') {
      let phraseIndex = 0;
      const interval = setInterval(() => {
        phraseIndex = (phraseIndex + 1) % loadingPhrases.length;
        setLoadingText(loadingPhrases[phraseIndex]);
      }, 3000);

      // Minimum loading time 8-15 seconds
      const timeout = setTimeout(() => {
        // In a real app, we'd wait for the API to finish
      }, 10000);

      return () => {
        clearInterval(interval);
        clearTimeout(timeout);
      };
    }
  }, [view]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery) return;

    setView('loading');

    try {
      // Check seed data first
      const seed = (seedData as any)[searchQuery];
      if (seed) {
        // Simulate network delay for loading effect
        await new Promise(resolve => setTimeout(resolve, 8000));
        setEras(seed.eras);
        setView('memoir');
        return;
      }

      const generatedEras = await generateMemoir(searchQuery);
      
      // Ensure minimum loading time
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      setEras(generatedEras);
      setView('memoir');
    } catch (error) {
      console.error(error);
      // Fallback to seed data if API fails for demo purposes
      setEras((seedData as any)["215 N Peoria St"].eras);
      setView('memoir');
    }
  };

  const getEraBg = (id: string) => {
    switch (id) {
      case 'origins': return 'bg-[#1a120b]'; // Darker and warmer
      case 'boom': return 'bg-[#2c1e12]';
      case 'turning-point': return 'bg-[#2a2a2a]';
      case 'struggle': return 'bg-[#1f1f1f]'; // Cooler and grayer
      case 'today': return 'bg-[#121212]'; // Luminous
      default: return 'bg-zinc-950';
    }
  };

  if (view === 'landing') {
    return (
      <div className="relative h-screen w-full overflow-hidden flex items-center justify-center bg-black">
        {/* Background with Ken Burns effect */}
        <div className="absolute inset-0 z-0">
          <img 
            src="https://picsum.photos/seed/chicago-old/1920/1080?grayscale" 
            className="w-full h-full object-cover opacity-40 animate-ken-burns"
            alt="Old Chicago"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 sepia-overlay mix-blend-multiply"></div>
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.5 }}
          className="relative z-10 max-w-2xl w-full px-6 text-center"
        >
          <h1 className="font-serif text-5xl md:text-7xl mb-8 leading-tight tracking-tight text-amber-50/90">
            Every block has a story. <br />
            <span className="italic">What does yours remember?</span>
          </h1>

          <form onSubmit={handleSearch} className="relative group">
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Enter a Chicago address, neighborhood, or zip..."
              className="w-full bg-white/10 backdrop-blur-md border border-white/20 rounded-full py-5 px-8 pr-16 text-xl focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all placeholder:text-zinc-500"
            />
            <button 
              type="submit"
              className="absolute right-3 top-1/2 -translate-y-1/2 bg-amber-600 hover:bg-amber-500 text-white p-3 rounded-full transition-colors"
            >
              <Search size={24} />
            </button>
          </form>
          
          <div className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-3 text-zinc-400 text-sm">
            <span className="w-full text-zinc-500 text-xs uppercase tracking-widest mb-1">Try these historical sites:</span>
            <button onClick={() => setSearchQuery('215 N Peoria St')} className="hover:text-amber-400 underline decoration-amber-400/30">Fulton Market</button>
            <button onClick={() => setSearchQuery('1900 S Michigan Ave')} className="hover:text-amber-400 underline decoration-amber-400/30">Motor Row</button>
            <button onClick={() => setSearchQuery('18th & Halsted')} className="hover:text-amber-400 underline decoration-amber-400/30">Pilsen</button>
            <button onClick={() => setSearchQuery('47th & King Drive')} className="hover:text-amber-400 underline decoration-amber-400/30">Bronzeville</button>
            <button onClick={() => setSearchQuery('Logan Square Monument')} className="hover:text-amber-400 underline decoration-amber-400/30">Logan Square</button>
            <button onClick={() => setSearchQuery('Wrigley Field')} className="hover:text-amber-400 underline decoration-amber-400/30">Lakeview</button>
            <button onClick={() => setSearchQuery('Pullman National Monument')} className="hover:text-amber-400 underline decoration-amber-400/30">Pullman</button>
          </div>
        </motion.div>

        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-zinc-500 text-xs uppercase tracking-[0.3em]">
          The City Remembers • Chicago Oral History
        </div>
        <ChicagoSoundtrack 
          currentSong={currentSong}
          setCurrentSong={setCurrentSong}
          isMusicPlaying={isMusicPlaying}
          setIsMusicPlaying={setIsMusicPlaying}
          isModalOpen={isMusicModalOpen}
          setIsModalOpen={setIsMusicModalOpen}
        />
      </div>
    );
  }

  if (view === 'loading') {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-zinc-950 text-amber-50/80">
        <AnimatePresence mode="wait">
          <motion.p
            key={loadingText}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.8 }}
            className="font-serif text-3xl italic text-center px-6"
          >
            {loadingText}
          </motion.p>
        </AnimatePresence>
        <div className="mt-12 w-48 h-px bg-zinc-800 relative overflow-hidden">
          <motion.div 
            className="absolute inset-0 bg-amber-600/50"
            initial={{ x: '-100%' }}
            animate={{ x: '100%' }}
            transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
          />
        </div>
        <ChicagoSoundtrack 
          currentSong={currentSong}
          setCurrentSong={setCurrentSong}
          isMusicPlaying={isMusicPlaying}
          setIsMusicPlaying={setIsMusicPlaying}
          isModalOpen={isMusicModalOpen}
          setIsModalOpen={setIsMusicModalOpen}
        />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-zinc-950">
      {/* Left Rail Navigation */}
      <nav className="fixed left-0 top-0 bottom-0 w-20 md:w-64 border-r border-white/5 z-50 flex flex-col bg-zinc-950/80 backdrop-blur-xl">
        <div className="p-6 border-b border-white/5">
          <button 
            onClick={() => setView('landing')}
            className="font-serif text-xl italic text-amber-500 hover:text-amber-400 transition-colors"
          >
            The City <br /> Remembers
          </button>
        </div>
        
        <div className="flex-1 py-12 px-4 flex flex-col gap-8">
          <div className="mb-4 flex flex-col gap-2">
            <button
              onClick={() => setActiveTab('memoir')}
              className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-all ${activeTab === 'memoir' ? 'bg-amber-500/10 text-amber-500' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              <Clock size={16} />
              <span className="text-xs uppercase tracking-widest font-bold">Timeline</span>
            </button>
            <button
              onClick={() => setActiveTab('map')}
              className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-all ${activeTab === 'map' ? 'bg-amber-500/10 text-amber-500' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              <MapIcon size={16} />
              <span className="text-xs uppercase tracking-widest font-bold">Map View</span>
            </button>
            <button
              onClick={() => setActiveTab('cinematic')}
              className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-all ${activeTab === 'cinematic' ? 'bg-amber-500/10 text-amber-500' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              <Play size={16} />
              <span className="text-xs uppercase tracking-widest font-bold">Cinematic</span>
            </button>
          </div>

          <div className="h-px bg-white/5 my-4" />

          {eras.map((era, idx) => (
            <button
              key={era.id}
              onClick={() => {
                setActiveEra(idx);
                document.getElementById(era.id)?.scrollIntoView({ behavior: 'smooth' });
              }}
              className={`text-left group flex items-center gap-4 transition-all ${activeEra === idx ? 'text-amber-500' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              <span className={`w-1 h-1 rounded-full bg-current transition-all ${activeEra === idx ? 'scale-[3]' : 'group-hover:scale-150'}`} />
              <span className="hidden md:block text-sm uppercase tracking-widest font-medium">
                {era.title.split(' (')[0]}
              </span>
            </button>
          ))}
        </div>

        <div className="p-6 border-t border-white/5 text-zinc-600 text-[10px] uppercase tracking-widest hidden md:block">
          {searchQuery}
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 ml-20 md:ml-64">
        {activeTab === 'memoir' ? (
          <>
            {/* Hero Video Section */}
            <section className="h-[70vh] w-full relative overflow-hidden bg-zinc-950">
              <video 
                autoPlay 
                loop 
                muted 
                playsInline
                className="absolute inset-0 w-full h-full object-cover opacity-50"
              >
                <source src="/evolution.mp4" type="video/mp4" />
              </video>
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-zinc-950/50 to-zinc-950" />
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
                <motion.h1 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="font-serif text-5xl md:text-7xl text-amber-50/90 italic mb-4"
                >
                  {searchQuery}
                </motion.h1>
                <motion.p 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  className="text-amber-500/60 uppercase tracking-[0.5em] text-xs font-bold"
                >
                  A Geographic Memoir
                </motion.p>
              </div>
            </section>

            {eras.map((era, idx) => (
            <section 
              key={era.id}
              id={era.id}
              className={`min-h-screen flex flex-col justify-center py-24 px-6 md:px-24 transition-colors duration-1000 ${getEraBg(era.id)}`}
              onMouseEnter={() => setActiveEra(idx)}
            >
              <motion.div
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 1 }}
                className="max-w-4xl mx-auto"
              >
                <div className="flex items-center gap-4 mb-4 text-amber-500/60 uppercase tracking-[0.4em] text-xs font-bold">
                  <Clock size={14} />
                  {era.title}
                </div>

                <h2 className="font-serif text-4xl md:text-6xl mb-12 text-amber-50/90 leading-tight">
                  {era.title.split(' (')[0]}
                </h2>

                <div className="grid md:grid-cols-2 gap-12 items-start">
                  <div className="space-y-8">
                    <p className="text-xl md:text-2xl leading-relaxed text-zinc-300 font-light">
                      {era.monologue}
                    </p>
                    
                    <blockquote className="font-serif text-3xl md:text-4xl italic text-amber-500/90 leading-tight py-8 border-y border-white/5">
                      "{era.pullQuote}"
                    </blockquote>

                    {era.mapLinks && era.mapLinks.length > 0 && (
                      <div className="pt-8">
                        <h4 className="text-[10px] uppercase tracking-[0.3em] text-zinc-500 mb-4 flex items-center gap-2">
                          <MapPin size={12} />
                          Geographic Context
                        </h4>
                        <div className="flex flex-wrap gap-3">
                          {era.mapLinks.map((link, lIdx) => (
                            <a 
                              key={lIdx}
                              href={link.uri}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-xs text-zinc-300 transition-all"
                            >
                              {link.title}
                              <ExternalLink size={10} />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="relative group">
                    <div className="aspect-[4/5] overflow-hidden rounded-sm vignette bg-zinc-900">
                      <img 
                        src={era.imageUrl || `https://picsum.photos/seed/${era.id}/800/1000?grayscale`} 
                        alt={era.title}
                        className="w-full h-full object-cover transition-transform duration-[10s] group-hover:scale-110"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <div className="absolute -bottom-4 -right-4 bg-zinc-900 p-4 border border-white/5 text-[10px] uppercase tracking-widest text-zinc-500 max-w-[200px] shadow-xl">
                      ARCHIVAL RECORD: {era.id.toUpperCase()} ERA
                    </div>

                    {era.videoUrl && (
                      <button 
                        onClick={() => setSelectedVideo(era.videoUrl!)}
                        className="absolute top-4 left-4 z-10 flex items-center gap-2 px-3 py-2 bg-black/60 backdrop-blur-md border border-white/10 rounded-full text-[10px] uppercase tracking-widest text-amber-500 font-bold hover:bg-amber-500 hover:text-black transition-all"
                      >
                        <Play size={12} fill="currentColor" />
                        Play Cinematic Memory
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            </section>
          ))}
          </>
        ) : activeTab === 'map' ? (
          <MapView searchQuery={searchQuery} eras={eras} onPlayVideo={setSelectedVideo} />
        ) : (
          <CinematicView searchQuery={searchQuery} />
        )}

        <AnimatePresence>
          {selectedVideo && (
            <VideoModal videoUrl={selectedVideo} onClose={() => setSelectedVideo(null)} />
          )}
        </AnimatePresence>

        <footer className="py-24 px-6 text-center bg-zinc-950 border-t border-white/5">
          <p className="font-serif text-2xl italic text-zinc-500 mb-8">
            The city never forgets. It only waits for someone to listen.
          </p>
          <button 
            onClick={() => {
              setView('landing');
              window.scrollTo(0, 0);
            }}
            className="px-8 py-3 rounded-full border border-zinc-800 hover:border-amber-500/50 hover:text-amber-500 transition-all uppercase tracking-widest text-xs"
          >
            Search Another Story
          </button>
        </footer>
        <ChicagoSoundtrack 
          currentSong={currentSong}
          setCurrentSong={setCurrentSong}
          isMusicPlaying={isMusicPlaying}
          setIsMusicPlaying={setIsMusicPlaying}
          isModalOpen={isMusicModalOpen}
          setIsModalOpen={setIsMusicModalOpen}
        />
      </main>
    </div>
  );
}
