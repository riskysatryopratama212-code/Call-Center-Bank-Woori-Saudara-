/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Helmet } from 'react-helmet-async';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { GoogleGenAI } from "@google/genai";
import ReactMarkdown from "react-markdown";
import { APIProvider, Map, AdvancedMarker, Pin, InfoWindow, useAdvancedMarkerRef, useMap } from '@vis.gl/react-google-maps';
import { MarkerClusterer } from '@googlemaps/markerclusterer';
import firebaseConfig from '../firebase-applet-config.json';
import { 
  PhoneCall, 
  MessageCircle, 
  ChevronRight, 
  ShieldCheck, 
  Clock, 
  HelpCircle, 
  Info,
  CreditCard,
  Smartphone,
  MapPin,
  FileText,
  Search,
  X,
  Upload,
  Trash2,
  Video,
  Image as ImageIcon,
  PlayCircle,
  Globe,
  Share2,
  MessageSquare,
  Loader2,
  CheckCircle2,
  Send,
  User,
  Bot,
  Sparkles,
  Menu,
  LifeBuoy,
  Navigation
} from "lucide-react";

// Initialize Gemini
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Google Maps API Key handling
const GOOGLE_MAPS_API_KEY =
  process.env.GOOGLE_MAPS_PLATFORM_KEY ||
  (import.meta as any).env?.VITE_GOOGLE_MAPS_PLATFORM_KEY ||
  (globalThis as any).GOOGLE_MAPS_PLATFORM_KEY ||
  '';
const hasValidMapsKey = Boolean(GOOGLE_MAPS_API_KEY) && GOOGLE_MAPS_API_KEY !== 'YOUR_API_KEY';

// Marker with InfoWindow component
const MarkerWithInfoWindow = React.forwardRef<
  google.maps.marker.AdvancedMarkerElement,
  {
    position: google.maps.LatLngLiteral;
    title: string;
    branch: any;
    onShare: (item: { title: string, text?: string }) => void;
    isSelected?: boolean;
    onClick: () => void;
  }
>(({ position, title, branch, onShare, isSelected, onClick }, ref) => {
  const [internalRef, marker] = useAdvancedMarkerRef();
  const [open, setOpen] = useState(false);

  // Sync internal ref with forwarded ref
  useEffect(() => {
    if (!ref) return;
    if (typeof ref === 'function') {
      ref(marker);
    } else {
      (ref as any).current = marker;
    }
  }, [marker, ref]);

  useEffect(() => {
    if (isSelected) {
      setOpen(true);
    }
  }, [isSelected]);

  return (
    <>
      <AdvancedMarker 
        ref={internalRef} 
        position={position} 
        onClick={() => { setOpen(true); onClick(); }} 
        title={title}
        zIndex={isSelected ? 1000 : 1}
      >
        <div className="relative">
          {isSelected && (
            <motion.div 
              initial={{ scale: 0.8, opacity: 0.5 }}
              animate={{ scale: [1, 2, 1], opacity: [0.5, 0, 0.5] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
              className="absolute inset-0 bg-[#FFD700] rounded-full -m-1"
            />
          )}
          <Pin 
            background={isSelected ? "#FFD700" : "#004A99"} 
            glyphColor={isSelected ? "#000" : "#fff"} 
            borderColor={isSelected ? "#000" : "#fff"}
            scale={isSelected ? 1.3 : 1}
          />
        </div>
      </AdvancedMarker>
      {open && (
        <InfoWindow anchor={marker} onCloseClick={() => setOpen(false)}>
          <div className="p-2 max-w-[200px]">
             <h4 className="font-bold text-[#004A99] mb-1">{title}</h4>
             <p className="text-[10px] text-slate-500 mb-2 leading-tight">{branch.address}</p>
             <div className="flex items-center gap-4 border-t border-slate-100 pt-2">
                <a 
                  href={`https://www.google.com/maps/dir/?api=1&destination=${position.lat},${position.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] font-bold text-[#004A99] flex items-center gap-1 hover:underline"
                >
                  <Navigation className="w-2.5 h-2.5" /> Rute
                </a>
                <button 
                  onClick={() => onShare({ title: branch.name, text: `Lokasi ${branch.name}: ${branch.address}. Telp: ${branch.phone}` })}
                  className="text-[10px] font-bold text-slate-400 flex items-center gap-1 hover:text-[#004A99]"
                >
                  <Share2 className="w-2.5 h-2.5" /> Bagikan
                </button>
             </div>
          </div>
        </InfoWindow>
      )}
    </>
  );
});

MarkerWithInfoWindow.displayName = 'MarkerWithInfoWindow';

// Marker Clusterer Component
function Markers({ branches, selectedId, onMarkerClick, onShare }: {
  branches: any[];
  selectedId: number | null;
  onMarkerClick: (id: number) => void;
  onShare: (item: { title: string, text?: string }) => void;
}) {
  const map = useMap();
  const [markers, setMarkers] = useState<{[key: number]: google.maps.marker.AdvancedMarkerElement}>({});
  const clusterer = useRef<MarkerClusterer | null>(null);

  useEffect(() => {
    if (!map) return;
    if (!clusterer.current) {
      clusterer.current = new MarkerClusterer({ map });
    }
  }, [map]);

  useEffect(() => {
    clusterer.current?.clearMarkers();
    clusterer.current?.addMarkers(Object.values(markers));
  }, [markers]);

  const setMarkerRef = (marker: google.maps.marker.AdvancedMarkerElement | null, id: number) => {
    if (marker) {
      setMarkers(prev => {
        if (prev[id] === marker) return prev;
        return { ...prev, [id]: marker };
      });
    } else {
      setMarkers(prev => {
        if (!prev[id]) return prev;
        const newMarkers = { ...prev };
        delete newMarkers[id];
        return newMarkers;
      });
    }
  };

  return (
    <>
      {branches.map((branch) => (
        <MarkerWithInfoWindow 
          key={branch.id} 
          position={branch.coords} 
          title={branch.name} 
          branch={branch}
          onShare={onShare}
          isSelected={selectedId === branch.id}
          onClick={() => onMarkerClick(branch.id)}
          ref={(marker) => setMarkerRef(marker, branch.id)}
        />
      ))}
    </>
  );
}

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: null,
      email: null,
      emailVerified: null,
      isAnonymous: null,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export default function App() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const phoneNumber = "+6281328282521";
  const whatsappNumber = "6281328282521";

  // SEO Structured Data (JSON-LD)
  useEffect(() => {
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.innerHTML = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "BankOrCreditUnion",
      "name": "Bank Woori Saudara (BWS) Call Center",
      "url": "https://bankwoorisaudara.com",
      "contactPoint": {
        "@type": "ContactPoint",
        "telephone": "+62-813-2828-2521",
        "contactType": "customer service",
        "areaServed": "ID",
        "availableLanguage": ["Indonesian", "English"]
      }
    });
    document.head.appendChild(script);
    return () => {
      const existingScript = document.head.querySelector('script[type="application/ld+json"]');
      if (existingScript) document.head.removeChild(existingScript);
    };
  }, []);

  const handleCall = () => {
    window.location.href = `tel:${phoneNumber}`;
  };

  const handleWhatsapp = () => {
    window.open(`https://wa.me/${whatsappNumber}?text=Halo%20BWS%20Call,%20saya%20ingin%20melakukan%20pengaduan%20nasabah.`, "_blank");
  };

  const complaintCategories = [
    {
      title: "ATM & Debit Card",
      icon: <CreditCard className="w-6 h-6" />,
      description: "Masalah penarikan tunai, kartu tertelan, atau kehilangan kartu ATM.",
      items: ["Kartu Tertelan", "Transaksi Gagal tapi Saldo Terpotong", "Blokir Kartu"]
    },
    {
      title: "Mobile Banking",
      icon: <Smartphone className="w-6 h-6" />,
      description: "Masalah aktivasi, login, atau transaksi G-Mobile BWS.",
      items: ["Lupa Password", "Gagal Transaksi", "Perubahan Nomor HP"]
    },
    {
      title: "Layanan Cabang",
      icon: <MapPin className="w-6 h-6" />,
      description: "Keluhan terkait pelayanan di kantor cabang Bank Woori Saudara.",
      items: ["Antrean Lama", "Sikap Petugas", "Fasilitas Kantor"]
    },
    {
      title: "Kredit & Pinjaman",
      icon: <FileText className="w-6 h-6" />,
      description: "Informasi tagihan, pelunasan, atau keluhan terkait produk kredit.",
      items: ["Suku Bunga", "Penagihan", "Dokumen Agunan"]
    }
  ];

  const filteredCategories = complaintCategories.filter(cat => 
    cat.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
    cat.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    cat.items.some(item => item.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const HighlightText = ({ text, highlight }: { text: string; highlight: string }) => {
    if (!highlight.trim()) return <span>{text}</span>;
    const regex = new RegExp(`(${highlight.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
    const parts = text.split(regex);
    return (
      <span>
        {parts.map((part, i) => 
          regex.test(part) ? (
            <mark key={i} className="bg-yellow-200 text-slate-900 rounded-sm px-0.5 font-inherit">{part}</mark>
          ) : (
            <span key={i}>{part}</span>
          )
        )}
      </span>
    );
  };

  const [mapInstance, setMapInstance] = useState<google.maps.Map | null>(null);
  const [selectedBranchId, setSelectedBranchId] = useState<number | null>(null);

  const MapHandler = () => {
    const map = useMap();
    useEffect(() => {
      if (map) setMapInstance(map);
    }, [map]);
    return null;
  };

  const medanBranches = [
    {
      id: 1,
      name: "Kantor Cabang (KC) Medan",
      address: "Jl. Putri Hijau No. 12, Kel. Kesawan, Kec. Medan Barat, Kota Medan, Sumatera Utara 20111",
      phone: "+6261-4521906",
      coords: { lat: 3.5939, lng: 98.6756 }
    },
    {
      id: 2,
      name: "KCP Medan Thamrin",
      address: "Jl. Thamrin No. 84, Kel. Sei Rengas II, Kec. Medan Area, Kota Medan, Sumatera Utara 20211",
      phone: "+6261-7360906",
      coords: { lat: 3.5846, lng: 98.6883 }
    },
    {
      id: 3,
      name: "KCP Medan Gatot Subroto",
      address: "Jl. Gatot Subroto No. 182, Kel. Sei Sikambing C II, Kec. Medan Helvetia, Kota Medan, Sumatera Utara 20123",
      phone: "+6261-8451906",
      coords: { lat: 3.5852, lng: 98.6534 }
    },
    {
      id: 4,
      name: "KCP Medan Brigjend Katamso",
      address: "Jl. Brigjend Katamso No. 248, Kel. Kampung Baru, Kec. Medan Maimun, Kota Medan, Sumatera Utara 20152",
      phone: "+6261-4531234",
      coords: { lat: 3.5714, lng: 98.6853 }
    },
    {
      id: 5,
      name: "KCP Medan Setia Budi",
      address: "Jl. Setia Budi No. 120, Kel. Tanjung Sari, Kec. Medan Selayang, Kota Medan, Sumatera Utara 20132",
      phone: "+6261-8214567",
      coords: { lat: 3.5587, lng: 98.6342 }
    },
    {
      id: 6,
      name: "KCP Medan Krakatau",
      address: "Jl. Gunung Krakatau No. 115, Kel. Glugur Darat II, Kec. Medan Timur, Kota Medan, Sumatera Utara 20238",
      phone: "+6261-6637890",
      coords: { lat: 3.6212, lng: 98.6821 }
    }
  ];

  const [medanSearch, setMedanSearch] = useState("");
  const filteredMedanBranches = medanBranches.filter(branch => 
    branch.name.toLowerCase().includes(medanSearch.toLowerCase()) || 
    branch.address.toLowerCase().includes(medanSearch.toLowerCase())
  );

  const branchRefs = useRef<{[key: number]: HTMLDivElement | null}>({});

  const handleBranchClick = (branch: any) => {
    setSelectedBranchId(branch.id);
    if (mapInstance) {
      // Use smooth transition for both pan and zoom if possible
      mapInstance.panTo(branch.coords);
      // Slight delay for zoom to make it feel more intentional after pan starts
      setTimeout(() => {
        mapInstance.setZoom(16);
      }, 300);
    }
    // Scroll list to element
    const element = branchRefs.current[branch.id];
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  };

  const galleryItems = [
    { type: 'image', url: 'https://images.unsplash.com/photo-1601597121915-e4c2517a397a?q=80&w=1200&auto=format&fit=crop', title: 'Layanan Nasabah BWS' },
    { type: 'video', url: 'https://assets.mixkit.co/videos/preview/mixkit-man-working-at-his-desk-in-an-office-40176-large.mp4', title: 'Aplikasi G-Mobile BWS', thumbnail: 'https://images.unsplash.com/photo-1563986768609-322da13575f3?q=80&w=800&auto=format&fit=crop' },
    { type: 'image', url: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?q=80&w=1200&auto=format&fit=crop', title: 'Keamanan Transaksi ATM' },
    { type: 'image', url: 'https://images.unsplash.com/photo-1454165833767-027eeea15c3e?q=80&w=1200&auto=format&fit=crop', title: 'Program Promo Menarik' }
  ];

  const handleShareContent = async (item: { title: string, text?: string }) => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: item.title,
          text: item.text || `Lihat ${item.title} dari Bank Woori Saudara`,
          url: window.location.href,
        });
      } catch (err) {
        console.error("Error sharing:", err);
      }
    } else {
      // Fallback: Copy to clipboard
      try {
        await navigator.clipboard.writeText(window.location.href);
        alert("Link situs berhasil disalin ke clipboard!");
      } catch (err) {
        console.error("Failed to copy:", err);
      }
    }
  };

  const [uploadedVideo, setUploadedVideo] = useState<string | null>(null);
  const [videoThumbnail, setVideoThumbnail] = useState<string | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const generateVideoThumbnail = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.src = URL.createObjectURL(file);
      video.muted = true;
      video.onloadedmetadata = () => {
        video.currentTime = 1; // Capture at 1 second
      };
      video.onseeked = () => {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);
        const thumbnailStr = canvas.toDataURL('image/jpeg', 0.7);
        URL.revokeObjectURL(video.src);
        resolve(thumbnailStr);
      };
      video.onerror = () => {
        URL.revokeObjectURL(video.src);
        resolve("");
      };
    });
  };

  const handleVideoUpload = async (file: File) => {
    if (file && file.type.startsWith('video/')) {
      const url = URL.createObjectURL(file);
      setUploadedVideo(url);
      setVideoFile(file);
      
      try {
        const thumb = await generateVideoThumbnail(file);
        setVideoThumbnail(thumb);
      } catch (err) {
        console.error("Thumbnail generation failed:", err);
      }
    } else {
      alert("Mohon unggah file video yang valid.");
    }
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleVideoUpload(e.target.files[0]);
    }
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => {
    setIsDragging(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleVideoUpload(e.dataTransfer.files[0]);
    }
  };

  const removeVideo = () => {
    if (uploadedVideo) {
      URL.revokeObjectURL(uploadedVideo);
    }
    setUploadedVideo(null);
    setVideoThumbnail(null);
    setVideoFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackName, setFeedbackName] = useState("");
  const [feedbackEmail, setFeedbackEmail] = useState("");
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
  const [isFeedbackSubmitted, setIsFeedbackSubmitted] = useState(false);

  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [messages, setMessages] = useState<{ role: 'user' | 'model', content: string }[]>([
    { role: 'model', content: "Halo! Saya adalah Asisten AI Bank Woori Saudara. Ada yang bisa saya bantu terkait layanan BWS Call atau FAQ kami?" }
  ]);
  const [isTyping, setIsTyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || isTyping) return;

    const userMessage = chatInput.trim();
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setChatInput("");
    setIsTyping(true);

    try {
      const faqData = `
        Q: Apakah layanan BWS Call berbayar?
        A: Layanan telepon dikenakan biaya pulsa sesuai operator. WhatsApp Chat gratis (hanya kuota).

        Q: Berapa lama proses penanganan keluhan?
        A: Lisan: 2 hari kerja. Tertulis: maks 10 hari kerja.

        Q: Bagaimana cara melakukan blokir kartu ATM?
        A: Hubungi BWS Call di 0813-2828-2521. Sampaikan kartu hilang/tertelan. Petugas akan blokir setelah verifikasi.

        Q: Apakah layanan BWS Call tersedia di hari libur?
        A: Ya, 24/7 termasuk hari libur nasional.

        Q: Apa yang harus disiapkan saat menelepon BWS Call?
        A: KTP, nomor rekening, dan detail kendala.
      `;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          ...messages.map(m => ({ role: m.role, parts: [{ text: m.content }] })),
          { role: 'user', parts: [{ text: userMessage }] }
        ],
        config: {
          systemInstruction: `Anda adalah asisten cerdas untuk Bank Woori Saudara (BWS). Gunakan data FAQ berikut untuk menjawab pertanyaan nasabah: ${faqData}. Jika jawaban tidak ada di FAQ, sarankan nasabah untuk menghubungi BWS Call di 0813-2828-2521 atau melalui WhatsApp resmi. Jawablah dengan ramah, profesional, dan dalam Bahasa Indonesia. Gunakan format markdown jika diperlukan.`,
        }
      });

      const modelResponse = response.text || "Maaf, saya sedang mengalami kendala teknis. Silakan coba beberapa saat lagi.";
      setMessages(prev => [...prev, { role: 'model', content: modelResponse }]);
    } catch (error) {
      console.error("Gemini Error:", error);
      setMessages(prev => [...prev, { role: 'model', content: "Maaf, terjadi kesalahan saat memproses permintaan Anda. Mohon hubungi Call Center kami jika masalah berlanjut." }]);
    } finally {
      setIsTyping(false);
    }
  };

  const submitFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedbackText.trim()) return;

    setIsSubmittingFeedback(true);
    const path = 'feedbacks';
    try {
      await addDoc(collection(db, path), {
        text: feedbackText,
        name: feedbackName || "Anonymous",
        email: feedbackEmail || null,
        createdAt: serverTimestamp(),
      });
      setIsFeedbackSubmitted(true);
      setFeedbackText("");
      setFeedbackName("");
      setFeedbackEmail("");
      setTimeout(() => {
        setIsFeedbackSubmitted(false);
        setIsFeedbackOpen(false);
      }, 3000);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    } finally {
      setIsSubmittingFeedback(false);
    }
  };

  return (
    <div id="bws-landing" className="min-h-screen bg-[#F8FAFC] text-[#1E293B] font-sans selection:bg-[#004A99] selection:text-white scroll-smooth">
      <Helmet>
        <title>Bank Woori Saudara (BWS) Medan - Kantor Cabang & Layanan Terpercaya</title>
        <meta name="description" content="Temukan lokasi kantor cabang Bank Woori Saudara (BWS) di Medan. Cari alamat, nomor telepon, dan lokasi tepatnya di peta interaktif. Layanan perbankan profesional untuk Anda." />
        <meta name="keywords" content="Bank Woori Saudara Medan, BWS Medan, Kantor Cabang BWS Medan, Lokasi BWS Medan, Bank Woori Saudara, Alamat BWS Medan" />
        <meta name="author" content="Bank Woori Saudara Medan" />
        
        {/* Open Graph / Facebook */}
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://bankwoorisaudara.com/" />
        <meta property="og:title" content="Bank Woori Saudara (BWS) Medan - Kantor Cabang & Layanan" />
        <meta property="og:description" content="Informasi lengkap lokasi kantor cabang dan layanan Bank Woori Saudara (BWS) di wilayah Medan. Hubungi kami untuk solusi perbankan Anda." />
        <meta property="og:image" content="https://www.bankwoorisaudara.com/assets/images/logo-bws.png" />

        {/* Twitter */}
        <meta property="twitter:card" content="summary_large_image" />
        <meta property="twitter:url" content="https://bankwoorisaudara.com/" />
        <meta property="twitter:title" content="Bank Woori Saudara (BWS) Medan" />
        <meta property="twitter:description" content="Cari kantor cabang Bank Woori Saudara (BWS) terdekat di Medan dengan mudah melalui peta interaktif kam." />
        <meta property="twitter:image" content="https://www.bankwoorisaudara.com/assets/images/logo-bws.png" />
      </Helmet>
      {/* Header */}
      <header id="main-header" className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="w-10 h-10 bg-[#004A99] rounded-lg flex items-center justify-center text-white font-bold text-xl">
              BWS
            </div>
            <span className="font-bold text-xl tracking-tight text-[#004A99] hidden sm:block">Bank Woori Saudara</span>
          </div>

          <div id="search-container" className="flex-grow max-w-md relative">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="Cari kategori pengaduan..." 
                className="w-full bg-slate-100 border-none rounded-full py-2 pl-10 pr-10 text-sm focus:ring-2 focus:ring-[#004A99] transition-all"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              {searchTerm && (
                <button 
                  onClick={() => setSearchTerm("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          <nav className="hidden md:flex gap-6 text-sm font-medium flex-shrink-0">
            <a href="#prosedur" className="hover:text-[#004A99] transition-colors">Pelaporan</a>
            <a href="#whatsapp-official" className="hover:text-[#004A99] transition-colors">WA Official</a>
            <a href="#gallery" className="hover:text-[#004A99] transition-colors">Galeri</a>
            <a href="#upload-video" className="hover:text-[#004A99] transition-colors font-bold text-[#25D366]">Lapor Video</a>
            <a href="#medan" className="hover:text-[#004A99] transition-colors">Lokasi Medan</a>
            <a href="#faq" className="bg-blue-50 text-[#004A99] px-4 py-2 rounded-xl hover:bg-blue-100 transition-all flex items-center gap-2">
              <HelpCircle className="w-4 h-4" /> Pusat Bantuan
            </a>
          </nav>

          <div className="flex items-center gap-2 md:hidden">
            <a href="#faq" className="p-2 text-[#004A99]">
              <HelpCircle className="w-6 h-6" />
            </a>
            <button 
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="p-2 text-[#004A99]"
            >
              {isMenuOpen ? <X className="w-8 h-8" /> : <Menu className="w-8 h-8" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {isMenuOpen && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden bg-white border-t border-slate-100 overflow-hidden"
            >
              <nav className="flex flex-col p-4 gap-4 text-sm font-bold">
                <a href="#prosedur" onClick={() => setIsMenuOpen(false)} className="px-4 py-2 hover:bg-slate-50 rounded-xl transition-colors">Pelaporan</a>
                <a href="#whatsapp-official" onClick={() => setIsMenuOpen(false)} className="px-4 py-2 hover:bg-slate-50 rounded-xl transition-colors">WA Official</a>
                <a href="#gallery" onClick={() => setIsMenuOpen(false)} className="px-4 py-2 hover:bg-slate-50 rounded-xl transition-colors">Galeri</a>
                <a href="#upload-video" onClick={() => setIsMenuOpen(false)} className="px-4 py-2 text-[#25D366] hover:bg-slate-50 rounded-xl transition-colors">Lapor Video</a>
                <a href="#medan" onClick={() => setIsMenuOpen(false)} className="px-4 py-2 hover:bg-slate-50 rounded-xl transition-colors">Lokasi Medan</a>
                <a href="#faq" onClick={() => { setIsMenuOpen(false); setIsChatOpen(true); }} className="px-4 py-2 bg-blue-50 text-[#004A99] rounded-xl flex items-center justify-between">
                  <span>Pusat Bantuan & FAQ</span>
                  <HelpCircle className="w-4 h-4" />
                </a>
              </nav>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      <main>
        {/* Hero Section */}
        <section id="hero" className="relative pt-12 pb-24 overflow-hidden">
          <div className="max-w-7xl mx-auto px-4 relative z-10">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <motion.div 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6 }}
              >
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-100 text-[#004A99] rounded-full text-xs font-semibold uppercase tracking-wider mb-6">
                  <Clock className="w-3.5 h-3.5" />
                  Layanan 24 Jam Non-Stop
                </div>
                <h1 className="text-4xl md:text-6xl font-extrabold leading-tight tracking-tight mb-6">
                  BWS Call <br />
                  <span className="text-[#004A99]">Pengaduan Nasabah</span>
                </h1>
                <p className="text-lg text-slate-600 mb-10 max-w-xl leading-relaxed">
                  BWS Call adalah layanan perbankan 24 jam dari Bank Woori Saudara yang dapat diakses melalui telepon atau telepon selular (+62813-2828-2521). Kami siap membantu kendala perbankan Anda kapan saja dan di mana saja.
                </p>
                
                <div className="flex flex-wrap gap-4">
                  <motion.button 
                    id="cta-call"
                    onClick={handleCall}
                    whileHover={{ scale: 1.05, translateY: -2 }}
                    whileTap={{ scale: 0.98 }}
                    animate={{ y: [0, -4, 0] }}
                    transition={{ 
                      y: { duration: 3, repeat: Infinity, ease: "easeInOut" },
                      default: { duration: 0.2 }
                    }}
                    className="flex items-center gap-3 bg-[#004A99] hover:bg-[#003d7e] text-white px-8 py-4 rounded-xl font-bold shadow-lg shadow-blue-200 transition-colors relative overflow-hidden group"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] transition-transform"></div>
                    <PhoneCall className="w-5 h-5" />
                    Panggil BWS Call
                  </motion.button>
                  <motion.button 
                    id="cta-wa"
                    onClick={handleWhatsapp}
                    whileHover={{ scale: 1.05, translateY: -2 }}
                    whileTap={{ scale: 0.98 }}
                    transition={{ duration: 0.2 }}
                    className="flex items-center gap-3 bg-[#25D366] hover:bg-[#20bd5b] text-white px-8 py-4 rounded-xl font-bold shadow-lg shadow-green-200 transition-colors"
                  >
                    <MessageCircle className="w-5 h-5" />
                    Chat WhatsApp
                  </motion.button>
                </div>
              </motion.div>

              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.8 }}
                className="relative hidden lg:block"
              >
                <div className="aspect-square bg-gradient-to-br from-blue-500 to-[#004A99] rounded-3xl overflow-hidden shadow-2xl relative">
                  <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1549221590-4496089334f1?q=80&w=2670&auto=format&fit=crop')] bg-cover bg-center mix-blend-overlay opacity-40"></div>
                  <div className="absolute bottom-8 left-8 right-8 bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20">
                    <div className="flex items-center gap-4 mb-4">
                      <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-[#004A99]">
                        <ShieldCheck className="w-7 h-7" />
                      </div>
                      <div>
                        <div className="text-white font-bold">Terpercaya & Aman</div>
                        <div className="text-white/70 text-sm">Respon cepat dalam hitungan detik</div>
                      </div>
                    </div>
                  </div>
                </div>
                {/* Decorative dots */}
                <div className="absolute -top-6 -right-6 grid grid-cols-5 gap-2 opacity-20 text-[#004A99]">
                  {Array.from({ length: 25 }).map((_, i) => (
                    <div key={i} className="w-1.5 h-1.5 bg-current rounded-full" />
                  ))}
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* Tata Cara Pelaporan Section */}
        <section id="prosedur" className="py-24 bg-white">
          <div className="max-w-7xl mx-auto px-4">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold mb-4">Tata Cara Pelaporan</h2>
              <p className="text-slate-500 max-w-2xl mx-auto">Ikuti langkah-langkah berikut untuk melakukan pengaduan atau pelaporan kendala perbankan Anda.</p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                {
                  step: "01",
                  title: "Hubungi BWS Call",
                  desc: "Nasabah menghubungi BWS Call di nomor 0813-2828-2521 atau via menu chat WhatsApp."
                },
                {
                  step: "02",
                  title: "Verifikasi Data",
                  desc: "Petugas Call Center akan melakukan verifikasi data nasabah untuk memastikan keamanan akses akun."
                },
                {
                  step: "03",
                  title: "Tindakan Darurat",
                  desc: "Petugas Call Center akan melakukan blokir pada kartu ATM/Debit jika nasabah melaporkan kehilangan kartu."
                },
                {
                  step: "04",
                  title: "Registrasi Laporan",
                  desc: "Laporan akan diregistrasi ke sistem dan nasabah akan menerima nomor tiket pengaduan."
                }
              ].map((step, idx) => (
                <motion.div 
                  key={idx}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: idx * 0.1 }}
                  className="relative p-8 rounded-2xl border border-slate-100 bg-slate-50 group hover:bg-white hover:shadow-xl transition-all"
                >
                  <div className="text-5xl font-black text-blue-100 mb-4 group-hover:text-[#004A99] group-hover:opacity-10 transition-colors">{step.step}</div>
                  <h3 className="text-xl font-bold mb-2">{step.title}</h3>
                  <p className="text-slate-500 text-sm leading-relaxed">{step.desc}</p>
                  {idx < 3 && (
                    <div className="hidden lg:block absolute -right-3 top-1/2 -translate-y-1/2 z-10">
                      <ChevronRight className="w-6 h-6 text-slate-200" />
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Structured Data Section */}
        <section id="kategori" className="py-24 bg-slate-50">
          <div className="max-w-7xl mx-auto px-4">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold mb-4">Kategori Layanan Kami</h2>
              <p className="text-slate-500 max-w-2xl mx-auto">Cepat temukan bantuan sesuai dengan kategori kendala yang Anda alami.</p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
              {filteredCategories.length > 0 ? (
                filteredCategories.map((cat, idx) => (
                  <motion.div 
                    key={idx}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    whileHover={{ y: -5 }}
                    className="p-8 rounded-2xl bg-white border border-slate-200 hover:border-blue-200 hover:shadow-xl hover:shadow-blue-500/5 transition-all group"
                  >
                    <div className="w-12 h-12 bg-slate-50 rounded-xl shadow-sm text-[#004A99] flex items-center justify-center mb-6 group-hover:bg-[#004A99] group-hover:text-white transition-colors">
                      {cat.icon}
                    </div>
                    <h3 className="text-xl font-bold mb-3">
                      <HighlightText text={cat.title} highlight={searchTerm} />
                    </h3>
                    <p className="text-slate-500 text-sm mb-6 leading-relaxed">
                      <HighlightText text={cat.description} highlight={searchTerm} />
                    </p>
                    <ul className="space-y-3">
                      {cat.items.map((item, i) => (
                        <li key={i} className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                          <ChevronRight className="w-3 h-3 text-[#004A99]" />
                          <HighlightText text={item} highlight={searchTerm} />
                        </li>
                      ))}
                    </ul>
                  </motion.div>
                ))
              ) : (
                <div className="col-span-full py-12 text-center">
                  <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Search className="w-8 h-8 text-slate-300" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-600">Hasil tidak ditemukan</h3>
                  <p className="text-slate-400">Coba kata kunci lain atau hubungi langsung CS kami.</p>
                  <button 
                    onClick={() => setSearchTerm("")}
                    className="mt-4 text-[#004A99] font-semibold underline"
                  >
                    Hapus pencarian
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* WhatsApp Official Section */}
        <section id="whatsapp-official" className="py-24 bg-blue-50/50">
          <div className="max-w-7xl mx-auto px-4">
            <div className="grid lg:grid-cols-2 gap-16 items-center">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
              >
                <div className="flex items-center gap-2 mb-6">
                  <div className="w-12 h-1 bg-[#25D366]"></div>
                  <span className="text-[#25D366] font-bold tracking-widest text-xs uppercase">Official Business Account</span>
                </div>
                <h2 className="text-3xl md:text-4xl font-bold mb-6 flex items-center gap-3">
                  WhatsApp Resmi BWS
                  <div className="bg-[#004A99] text-white p-1 rounded-full flex items-center justify-center" title="Akun Resmi Terverifikasi">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                </h2>
                <p className="text-slate-600 mb-8 leading-relaxed">
                  Per April 2026, Bank Woori Saudara telah memperbarui layanan komunikasi melalui WhatsApp Business resmi. Pastikan Anda hanya berinteraksi dengan nomor yang memiliki <strong>Centang Biru (Official Verified)</strong> demi keamanan data Anda.
                </p>
                
                <div className="space-y-4 mb-10">
                  {[
                    "Informasi Produk & Layanan Terkini",
                    "Update Program & Promo Spesial",
                    "Layanan Pengaduan Nasabah 24 Jam",
                    "Pengingat Tagihan & Kewajiban Perbankan"
                  ].map((text, i) => (
                    <div key={i} className="flex items-center gap-3 text-slate-700 font-medium">
                      <div className="w-5 h-5 rounded-full bg-[#25D366]/20 flex items-center justify-center text-[#25D366]">
                        <ChevronRight className="w-3 h-3 font-bold" />
                      </div>
                      {text}
                    </div>
                  ))}
                </div>

                <div className="p-6 bg-white rounded-2xl border border-[#25D366]/30 shadow-sm inline-block relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-16 h-16 bg-[#25D366]/5 -rotate-45 translate-x-8 -translate-y-8"></div>
                  <div className="text-xs text-slate-400 uppercase font-bold mb-1">Nomor WhatsApp Aktif</div>
                  <div className="flex items-center gap-3">
                    <div className="text-2xl font-black text-[#1E293B] tracking-tight group-hover:text-[#004A99] transition-colors">+62 813-2828-2521</div>
                    <div className="w-6 h-6 bg-[#25D366] rounded-full flex items-center justify-center text-white shadow-sm shadow-green-100 ring-4 ring-[#25D366]/10" title="Terverifikasi Resmi">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    </div>
                  </div>
                </div>
              </motion.div>

              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                className="relative"
              >
                <div className="bg-white p-8 rounded-[2rem] shadow-xl border border-slate-100 flex flex-col items-center text-center">
                  <div className="w-24 h-24 bg-[#25D366] rounded-3xl flex items-center justify-center text-white mb-6 shadow-lg shadow-green-200">
                    <MessageCircle className="w-12 h-12" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">Interaksi Aman & Nyaman</h3>
                  <p className="text-slate-500 text-sm mb-8">Hubungi kami kapan saja. Kami siap membantu setiap kebutuhan transaksi perbankan Anda dengan respon cepat.</p>
                  <button 
                    onClick={handleWhatsapp}
                    className="w-full py-4 bg-[#25D366] text-white rounded-xl font-bold hover:bg-[#20bd5b] transition-all flex items-center justify-center gap-2"
                  >
                    Mulai Chat Sekarang <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* Gallery Section */}
        <section id="gallery" className="py-24 bg-white">
            <div className="max-w-7xl mx-auto px-4">
                <div className="text-center mb-16 px-4">
                    <h2 className="text-3xl font-bold mb-4 tracking-tight">Galeri Foto & Video</h2>
                    <p className="text-slate-500 max-w-xl mx-auto">Dokumentasi layanan, video tutorial aplikasi, dan informasi visual perbankan kami.</p>
                </div>

                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {galleryItems.map((item, idx) => (
                        <motion.div 
                            key={idx}
                            whileHover={{ y: -5 }}
                            className="group relative bg-slate-50 p-2 rounded-2xl border border-slate-200 overflow-hidden"
                        >
                            <div className="aspect-square rounded-xl overflow-hidden relative">
                                {item.type === 'video' ? (
                                    <>
                                        <img src={item.thumbnail} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                                        <div className="absolute inset-0 bg-black/30 flex items-center justify-center hover:bg-black/40 transition-colors">
                                            <PlayCircle className="w-12 h-12 text-white" />
                                        </div>
                                    </>
                                ) : (
                                    <img src={item.url} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                                )}
                            </div>
                            <div className="p-4">
                                <div className="flex items-start justify-between gap-2">
                                    <h3 className="font-bold text-slate-800 text-sm flex-grow">{item.title}</h3>
                                    <button 
                                        onClick={() => handleShareContent({ title: item.title })}
                                        className="p-1.5 text-slate-400 hover:text-[#004A99] hover:bg-blue-50 rounded-lg transition-colors"
                                        title="Bagikan"
                                    >
                                        <Share2 className="w-4 h-4" />
                                    </button>
                                </div>
                                <div className="text-[10px] text-slate-400 font-bold uppercase mt-1">
                                    {item.type === 'video' ? 'Video' : 'Foto'}
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>

        {/* Video Upload Section */}
        <section id="upload-video" className="py-24 bg-slate-50">
          <div className="max-w-4xl mx-auto px-4">
            <div className="bg-white rounded-3xl p-8 md:p-12 shadow-xl border border-slate-200">
              <div className="text-center mb-10">
                <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center text-[#004A99] mx-auto mb-6">
                  <Video className="w-8 h-8" />
                </div>
                <h2 className="text-3xl font-bold mb-4">Laporan Bukti Video</h2>
                <p className="text-slate-500">Unggah bukti video kejadian atau kendala transaksi Anda untuk mempercepat proses investigasi kami.</p>
              </div>

              {!uploadedVideo ? (
                <div 
                  onDragOver={onDragOver}
                  onDragLeave={onDragLeave}
                  onDrop={onDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`relative border-2 border-dashed rounded-3xl p-12 flex flex-col items-center justify-center transition-all cursor-pointer group ${
                    isDragging 
                      ? 'border-[#004A99] bg-blue-50' 
                      : 'border-slate-200 hover:border-[#004A99] hover:bg-slate-50'
                  }`}
                >
                  <input 
                    type="file" 
                    ref={fileInputRef}
                    onChange={onFileChange}
                    accept="video/*"
                    className="hidden"
                  />
                  <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                    <Upload className="w-10 h-10 text-slate-400 group-hover:text-[#004A99]" />
                  </div>
                  <div className="text-xl font-bold mb-2">Seret video ke sini</div>
                  <p className="text-slate-400 text-sm mb-6">atau klik untuk memilih file dari perangkat Anda</p>
                  <div className="flex gap-4 text-xs font-bold text-slate-400 uppercase tracking-widest">
                    <span>MP4</span>
                    <span>•</span>
                    <span>MOV</span>
                    <span>•</span>
                    <span>Max 50MB</span>
                  </div>
                </div>
              ) : (
                <div className="relative rounded-3xl overflow-hidden border border-slate-200 shadow-lg bg-black group">
                  <video 
                    src={uploadedVideo} 
                    poster={videoThumbnail || undefined}
                    controls 
                    className="w-full aspect-video"
                  />
                  <div className="absolute top-4 right-4 flex gap-2 overflow-hidden">
                    <button 
                      onClick={removeVideo}
                      className="p-3 bg-red-500 text-white rounded-full shadow-lg hover:bg-red-600 transition-colors"
                      title="Hapus Video"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="p-4 bg-white border-t border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center text-[#004A99]">
                        <Video className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-slate-800 truncate max-w-[200px]">
                          {videoFile?.name}
                        </div>
                        <div className="text-[10px] text-slate-400 font-bold uppercase">
                          {(videoFile!.size / (1024 * 1024)).toFixed(2)} MB • Siap Dikirim
                        </div>
                      </div>
                    </div>
                    <button 
                      onClick={handleWhatsapp}
                      className="px-6 py-2 bg-[#25D366] text-white rounded-full text-sm font-bold hover:bg-[#20bd5b] transition-colors flex items-center gap-2"
                    >
                      Kirim via WA <MessageCircle className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              <div className="mt-8 flex items-start gap-4 p-4 bg-blue-50 rounded-2xl border border-blue-100">
                <Info className="w-5 h-5 text-[#004A99] flex-shrink-0 mt-0.5" />
                <p className="text-xs text-[#004A99] leading-relaxed font-medium">
                  <strong>Tips Keamanan:</strong> Pastikan video Anda menunjukkan detail kendala dengan jelas (misal: layar ATM atau error Code di Mobile Banking). Jangan tunjukkan PIN atau data sensitif lainnya dalam video.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Medan Branch Section */}
        <section id="medan" className="py-24 bg-white">
          <div className="max-w-7xl mx-auto px-4">
            <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-4">
              <div>
                <h2 className="text-3xl font-bold mb-4">Lokasi Cabang Medan</h2>
                <p className="text-slate-500">Temukan layanan tatap muka di kantor cabang kami di wilayah Kota Medan.</p>
              </div>
              <a href="https://bankwoorisaudara.com" target="_blank" rel="noopener noreferrer" className="text-[#004A99] font-bold inline-flex items-center gap-2 hover:underline">
                Lihat Semua Cabang <ChevronRight className="w-4 h-4" />
              </a>
            </div>

            <div className="grid lg:grid-cols-3 gap-8 mb-12 h-[600px]">
              {hasValidMapsKey ? (
                <APIProvider apiKey={GOOGLE_MAPS_API_KEY} version="weekly">
                  <div className="lg:col-span-2 rounded-3xl overflow-hidden border border-slate-200 shadow-xl bg-slate-50 relative">
                    <Map
                      defaultCenter={{ lat: 3.5939, lng: 98.6756 }}
                      defaultZoom={12}
                      mapId="BWS_MEDAN_MAP"
                      internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
                      style={{ width: '100%', height: '100%' }}
                      gestureHandling="greedy"
                      disableDefaultUI
                    >
                      <MapHandler />
                      <Markers 
                        branches={filteredMedanBranches} 
                        selectedId={selectedBranchId}
                        onMarkerClick={(id) => {
                          const branch = medanBranches.find(b => b.id === id);
                          if (branch) handleBranchClick(branch);
                        }}
                        onShare={handleShareContent}
                      />
                    </Map>
                  </div>

                  <div className="flex flex-col h-full overflow-hidden">
                    <div className="relative mb-4">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input 
                        type="text" 
                        placeholder="Cari cabang di Medan..." 
                        className="w-full bg-slate-100 border-none rounded-xl py-3 pl-10 pr-4 text-sm focus:ring-2 focus:ring-[#004A99] transition-all"
                        value={medanSearch}
                        onChange={(e) => setMedanSearch(e.target.value)}
                      />
                    </div>

                    <div className="flex-grow overflow-y-auto pr-2 custom-scrollbar space-y-4">
                      {filteredMedanBranches.map((branch, idx) => (
                        <motion.div 
                          key={branch.id} 
                          ref={el => { branchRefs.current[branch.id] = el; }}
                          whileHover={{ scale: 1.02 }}
                          onClick={() => handleBranchClick(branch)}
                          className={`p-6 rounded-2xl border flex flex-col items-start shadow-sm hover:shadow-md transition-all cursor-pointer group relative overflow-hidden ${
                            selectedBranchId === branch.id 
                              ? 'bg-white border-[#004A99] ring-4 ring-[#004A99]/5 shadow-blue-100 shadow-lg' 
                              : 'bg-[#F8FAFC] border-slate-100'
                          }`}
                        >
                          {selectedBranchId === branch.id && (
                            <div className="absolute top-0 right-0 py-1 px-3 bg-[#004A99] text-white text-[10px] font-bold rounded-bl-xl uppercase tracking-tighter animate-in fade-in slide-in-from-top-2 duration-300">
                              Lokasi Terpilih
                            </div>
                          )}
                          <div className="flex items-start justify-between w-full mb-4">
                            <div className={`p-2 rounded-lg transition-colors ${
                              selectedBranchId === branch.id ? 'bg-[#004A99] text-white' : 'bg-blue-100 text-[#004A99] group-hover:bg-[#004A99] group-hover:text-white'
                            }`}>
                              <MapPin className="w-5 h-5" />
                            </div>
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleShareContent({ 
                                title: branch.name, 
                                text: `Lokasi ${branch.name}: ${branch.address}. Telp: ${branch.phone}` 
                              })}}
                              className="p-2 text-slate-400 hover:text-[#004A99] hover:bg-white rounded-xl transition-all"
                              title="Bagikan Lokasi"
                            >
                              <Share2 className="w-4 h-4" />
                            </button>
                          </div>
                          <h3 className={`text-md font-bold mb-2 ${selectedBranchId === branch.id ? 'text-[#004A99]' : ''}`}>{branch.name}</h3>
                          <p className="text-slate-500 text-xs mb-4 leading-relaxed">{branch.address}</p>
                          <div className="flex items-center justify-between w-full mt-auto">
                             <div className="flex items-center gap-2 text-[#004A99] font-bold text-xs">
                               <PhoneCall className="w-3 h-3" />
                               {branch.phone}
                             </div>
                             <a 
                               href={`https://www.google.com/maps/dir/?api=1&destination=${branch.coords.lat},${branch.coords.lng}`}
                               target="_blank"
                               rel="noopener noreferrer"
                               onClick={(e) => e.stopPropagation()}
                               className="p-2 bg-white text-[#004A99] rounded-lg shadow-sm hover:bg-blue-50 transition-colors"
                               title="Petunjuk Arah"
                             >
                               <Navigation className="w-4 h-4" />
                             </a>
                          </div>
                        </motion.div>
                      ))}
                      {filteredMedanBranches.length === 0 && (
                        <div className="text-center py-12 text-slate-400 text-sm">
                          Cabang tidak ditemukan
                        </div>
                      )}
                    </div>
                  </div>
                </APIProvider>
              ) : (
                <>
                  <div className="lg:col-span-2 rounded-3xl overflow-hidden border border-slate-200 shadow-xl bg-slate-50 relative">
                    <div className="flex items-center justify-center h-full p-8 text-center bg-slate-100">
                      <div className="max-w-md">
                        <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-sm text-slate-400">
                           <Globe className="w-8 h-8" />
                        </div>
                        <h3 className="text-xl font-bold mb-4">Google Maps API Key Diperlukan</h3>
                        <p className="text-sm text-slate-500 mb-6">Untuk melihat peta interaktif, Anda perlu menambahkan API Key di pengaturan project ini.</p>
                        
                        <div className="text-left text-xs bg-white p-6 rounded-2xl border border-slate-200 space-y-3">
                           <div className="font-bold text-[#004A99] uppercase tracking-wider">Instruksi:</div>
                           <p>1. Dapatkan API Key di <a href="https://console.cloud.google.com/google/maps-apis/start" target="_blank" className="underline font-bold">Google Cloud</a></p>
                           <p>2. Buka <strong>Settings</strong> (⚙️) di AI Studio</p>
                           <p>3. Pilih <strong>Secrets</strong></p>
                           <p>4. Tambahkan <code>GOOGLE_MAPS_PLATFORM_KEY</code></p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-4 overflow-y-auto pr-2 custom-scrollbar">
                    {medanBranches.map((branch, idx) => (
                      <div key={idx} className="p-6 rounded-2xl bg-[#F8FAFC] border border-slate-100 flex flex-col items-start shadow-sm">
                        <div className="flex items-start justify-between w-full mb-4">
                          <div className="p-2 bg-blue-100 rounded-lg text-[#004A99]">
                            <MapPin className="w-5 h-5" />
                          </div>
                        </div>
                        <h3 className="text-md font-bold mb-2">{branch.name}</h3>
                        <p className="text-slate-500 text-xs mb-4 leading-relaxed">{branch.address}</p>
                        <div className="flex items-center gap-2 text-[#004A99] font-bold text-xs mt-auto">
                          <PhoneCall className="w-3 h-3" />
                          {branch.phone}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section id="faq" className="py-24 bg-slate-50">
          <div className="max-w-3xl mx-auto px-4">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold">Frequently Asked Questions</h2>
              <p className="text-slate-500 mt-4">Punya pertanyaan? Mungkin jawaban ada di bawah ini.</p>
            </div>
            
            <div className="space-y-4">
              {[
                { 
                  q: "Apakah layanan BWS Call berbayar?", 
                  a: "Layanan telepon dikenakan biaya pulsa sesuai dengan operator telekomunikasi yang Anda gunakan (Telkomsel, Indosat, dll). Namun, jika Anda menghubungi via WhatsApp Chat, layanan ini sepenuhnya tidak dipungut biaya (hanya kuota internet)." 
                },
                { 
                  q: "Berapa lama proses penanganan keluhan?", 
                  a: "Sesuai regulasi, Bank Woori Saudara berkomitmen menyelesaikan pengaduan lisan dalam waktu 2 hari kerja, dan pengaduan tertulis dalam waktu maksimal 10 hari kerja (bergantung pada kompleksitas kasus)." 
                },
                { 
                  q: "Bagaimana cara melakukan blokir kartu ATM?", 
                  a: "Segera hubungi BWS Call di 0813-2828-2521. Sampaikan bahwa kartu Anda hilang atau tertelan. Setelah data diverifikasi, petugas akan langsung melakukan pemblokiran sistem demi keamanan dana Anda." 
                },
                {
                  q: "Apakah layanan BWS Call tersedia di hari libur?",
                  a: "Ya, BWS Call tersedia 24 jam sehari, 7 hari seminggu, termasuk hari libur nasional dan hari raya."
                },
                {
                  q: "Apa yang harus disiapkan saat menelepon BWS Call?",
                  a: "Pastikan Anda membawa identitas diri (KTP), nomor rekening, dan penjelasan detail mengenai kendala atau transaksi yang ingin diadukan agar petugas dapat membantu lebih cepat."
                }
              ].map((item, i) => (
                <details key={i} className="group bg-white p-6 rounded-2xl border border-slate-200 open:border-blue-300 transition-all shadow-sm">
                  <summary className="flex justify-between items-center cursor-pointer list-none list-inside font-bold hover:text-[#004A99] pr-4">
                    <span className="flex-grow">{item.q}</span>
                    <ChevronRight className="w-5 h-5 text-slate-400 group-open:rotate-90 transition-transform flex-shrink-0" />
                  </summary>
                  <div className="mt-4 text-slate-600 text-sm leading-relaxed border-t border-slate-100 pt-4 flex flex-col gap-4">
                    <p>{item.a}</p>
                    <div className="flex justify-end">
                      <button 
                        onClick={() => handleShareContent({ 
                          title: `FAQ: ${item.q}`, 
                          text: item.a 
                        })}
                        className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-[#004A99] transition-colors"
                      >
                        <Share2 className="w-3 h-3" /> Bagikan Jawaban
                      </button>
                    </div>
                  </div>
                </details>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="py-24 bg-[#1E293B] text-white">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-12 mb-20">
            {/* Logo & Info */}
            <div>
              <div className="flex items-center gap-3 mb-8">
                <div className="w-12 h-12 bg-[#004A99] rounded-xl flex items-center justify-center text-white font-bold text-2xl shadow-xl">
                  BWS
                </div>
                <div className="font-bold text-xl leading-none">BANK WOORI<br/><span className="text-[#004A99]">SAUDARA</span></div>
              </div>
              <p className="text-sm opacity-60 leading-relaxed font-medium mb-8">
                Memberikan solusi perbankan terdepan selama lebih dari satu abad dengan komitmen keamanan dan kenyamanan nasabah.
              </p>
              <div className="flex gap-4">
                <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center hover:bg-[#004A99] transition-all cursor-pointer"><Globe className="w-5 h-5" /></div>
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center hover:bg-[#004A99] transition-all cursor-pointer"><Share2 className="w-5 h-5" /></div>
              </div>
            </div>

            {/* Sitemap Section 1: Layanan */}
            <div>
              <h4 className="font-bold text-lg mb-8 tracking-tight">Sitemap - Layanan</h4>
              <ul className="text-sm space-y-4 opacity-50">
                <li className="hover:opacity-100 hover:text-blue-400 transition-all font-medium"><a href="#hero">Beranda Center</a></li>
                <li className="hover:opacity-100 hover:text-blue-400 transition-all font-medium"><a href="#whatsapp-official">WhatsApp Official</a></li>
                <li className="hover:opacity-100 hover:text-blue-400 transition-all font-medium"><a href="#gallery">Galeri & Media</a></li>
                <li className="hover:opacity-100 hover:text-blue-400 transition-all font-medium"><a href="#prosedur">Prosedur Pelaporan</a></li>
                <li className="hover:opacity-100 hover:text-blue-400 transition-all font-medium cursor-pointer" onClick={() => setIsFeedbackOpen(true)}>Kirim Feedback</li>
              </ul>
            </div>

            {/* Sitemap Section 2: Regional Medan */}
            <div>
              <h4 className="font-bold text-lg mb-8 tracking-tight">Kantor Medan</h4>
              <ul className="text-sm space-y-4 opacity-50">
                <li className="hover:opacity-100 hover:text-blue-400 transition-all font-medium"><a href="#medan">KC Medan Putri Hijau</a></li>
                <li className="hover:opacity-100 hover:text-blue-400 transition-all font-medium"><a href="#medan">KCP Thamrin Medan</a></li>
                <li className="hover:opacity-100 hover:text-blue-400 transition-all font-medium"><a href="#medan">KCP Gatot Subroto</a></li>
                <li className="hover:opacity-100 hover:text-blue-400 transition-all font-medium"><a href="https://bankwoorisaudara.com/lokasi-cabang">Cari Lokasi Lainnya</a></li>
              </ul>
            </div>

            {/* Contact Support */}
            <div>
              <h4 className="font-bold text-lg mb-8 tracking-tight">Hubungi Kami</h4>
              <div className="space-y-4">
                 <div className="flex items-start gap-4 p-4 rounded-2xl bg-white/5 border border-white/10">
                    <PhoneCall className="w-6 h-6 text-blue-400" />
                    <div>
                        <div className="text-[10px] uppercase font-bold tracking-widest opacity-40 mb-1">Telepon Official</div>
                        <div className="font-bold text-sm">+62 813-2828-2521</div>
                    </div>
                 </div>
                  <div className="flex items-start gap-4 p-4 rounded-2xl bg-white/5 border border-white/10">
                    <MessageCircle className="w-6 h-6 text-green-400" />
                    <div>
                        <div className="text-[10px] uppercase font-bold tracking-widest opacity-40 mb-1">WhatsApp Chat</div>
                        <div className="flex items-center gap-2">
                           <div className="font-bold text-sm">+62 813-2828-2521</div>
                           <CheckCircle2 className="w-3 h-3 text-green-400" />
                        </div>
                    </div>
                  </div>
              </div>
            </div>
          </div>

          <div className="pt-16 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="text-[10px] font-bold tracking-widest opacity-30 uppercase text-center md:text-left">
              &copy; {new Date().getFullYear()} PT BANK WOORI SAUDARA INDONESIA 1906, TBK.<br/>
              TERDAFTAR DAN DIAWASI OLEH OTORITAS JASA KEUANGAN (OJK).
            </div>
            <div className="flex items-center gap-6">
                <div className="bg-white/5 px-6 py-2 rounded-lg text-[10px] font-bold uppercase flex items-center gap-2">Penyertaan LPS <ShieldCheck className="w-3 h-3 text-blue-400" /></div>
                <div className="bg-white/5 px-6 py-2 rounded-lg text-[10px] font-bold uppercase flex items-center gap-2">SSL Secure <CreditCard className="w-3 h-3 text-green-400" /></div>
            </div>
          </div>
        </div>
      </footer>

      {/* Chatbot Window */}
      <AnimatePresence mode="wait">
        {isChatOpen && (
          <motion.div 
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-24 right-6 w-[calc(100%-3rem)] max-w-[380px] h-[550px] max-h-[70vh] bg-white rounded-[2.5rem] shadow-2xl border border-slate-200 z-[110] flex flex-col overflow-hidden"
          >
            <div className="p-6 bg-gradient-to-r from-[#004A99] to-blue-600 text-white flex items-center justify-between shadow-lg">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-md border border-white/10">
                  <Bot className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="font-bold">BWS AI Assistant</h3>
                  <div className="flex items-center gap-1.5 leading-none mt-0.5">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                    <span className="text-[10px] font-bold uppercase tracking-wider opacity-80">AI Aktif</span>
                  </div>
                </div>
              </div>
              <button 
                onClick={() => setIsChatOpen(false)}
                className="p-2.5 hover:bg-white/10 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-grow overflow-y-auto p-6 space-y-5 bg-slate-50/50">
              {messages.map((msg, idx) => (
                <motion.div 
                  key={idx}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`flex gap-3 max-w-[90%] ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm ${
                      msg.role === 'user' ? 'bg-blue-100 text-[#004A99]' : 'bg-white border border-slate-100 text-[#004A99]'
                    }`}>
                      {msg.role === 'user' ? <User className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
                    </div>
                    <div className={`rounded-3xl px-5 py-3.5 text-sm shadow-sm transition-all ${
                      msg.role === 'user' 
                        ? 'bg-[#004A99] text-white rounded-tr-none' 
                        : 'bg-white text-slate-700 border border-slate-100 rounded-tl-none'
                    }`}>
                      <div className="prose prose-sm prose-slate max-w-none leading-relaxed">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
              {isTyping && (
                <div className="flex justify-start">
                  <div className="flex gap-3 max-w-[90%]">
                    <div className="w-9 h-9 rounded-xl bg-white border border-slate-100 text-[#004A99] shadow-sm flex items-center justify-center">
                      <Bot className="w-5 h-5" />
                    </div>
                    <div className="bg-white border border-slate-100 rounded-3xl rounded-tl-none px-5 py-4 flex gap-1.5 items-center shadow-sm">
                      <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                      <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                      <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" />
                    </div>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            <form onSubmit={handleSendMessage} className="p-5 bg-white border-t border-slate-100 flex gap-3">
              <input 
                type="text" 
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Tanya perbankan..."
                className="flex-grow bg-slate-50 border border-slate-100 rounded-2xl px-5 py-3.5 text-sm focus:bg-white focus:ring-2 focus:ring-[#004A99] transition-all outline-none"
              />
              <button 
                type="submit"
                disabled={!chatInput.trim() || isTyping}
                className="w-12 h-12 bg-[#004A99] text-white rounded-2xl flex items-center justify-center hover:bg-[#003d7e] disabled:bg-slate-200 disabled:cursor-not-allowed transition-all shadow-lg shadow-blue-100 shrink-0"
              >
                <Send className="w-5 h-5" />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Action Buttons */}
      <div id="floating-actions" className="fixed bottom-6 right-6 flex flex-col gap-3 z-[100]">
        <motion.div
           initial={{ x: 100, opacity: 0 }}
           animate={{ x: 0, opacity: 1 }}
           transition={{ delay: 1 }}
           className="absolute bottom-[300px] right-0 translate-x-2"
        >
          <button 
            onClick={() => { setIsChatOpen(true); window.location.hash = "faq"; }}
            className="bg-white text-[#004A99] font-bold text-[10px] uppercase tracking-tighter py-3 px-4 rounded-l-2xl shadow-xl border border-slate-200 flex flex-col items-center gap-1 hover:pr-8 transition-all group"
          >
            <LifeBuoy className="w-4 h-4 animate-bounce" />
            <span>Bantuan</span>
          </button>
        </motion.div>

        <motion.button 
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => setIsChatOpen(!isChatOpen)}
          className="w-14 h-14 bg-gradient-to-br from-blue-600 to-[#004A99] text-white rounded-full shadow-xl flex items-center justify-center border-2 border-white relative group"
          title="Tanya AI"
        >
          {isChatOpen ? <X className="w-7 h-7" /> : <Bot className="w-7 h-7" />}
          <div className="absolute right-full mr-4 bg-white px-3 py-1.5 rounded-lg text-slate-800 text-xs font-bold whitespace-nowrap shadow-lg opacity-0 group-hover:opacity-100 transition-opacity border border-slate-100 pointer-events-none">
            Asisten AI BWS
          </div>
          <div className="absolute -top-1 -right-1 w-5 h-5 bg-green-500 border-2 border-white rounded-full flex items-center justify-center">
             <Sparkles className="w-2.5 h-2.5 text-white animate-pulse" />
          </div>
        </motion.button>
        <motion.button 
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={handleWhatsapp}
          className="w-14 h-14 bg-[#25D366] rounded-full shadow-2xl flex items-center justify-center text-white relative group"
        >
          <MessageCircle className="w-7 h-7" />
          <span className="absolute right-full mr-4 bg-white text-slate-800 px-3 py-1 rounded-md text-xs font-bold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity shadow-lg border border-slate-100">
            Chat WhatsApp
          </span>
        </motion.button>
        <motion.button 
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={handleCall}
          className="w-14 h-14 bg-[#004A99] rounded-full shadow-2xl flex items-center justify-center text-white relative group border-4 border-white"
        >
          <PhoneCall className="w-6 h-6" />
          <span className="absolute right-full mr-4 bg-white text-slate-800 px-3 py-1 rounded-md text-xs font-bold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity shadow-lg border border-slate-100">
            Hubungi Call Center
          </span>
        </motion.button>
      </div>

      {/* Feedback Modal */}
      <AnimatePresence>
        {isFeedbackOpen && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsFeedbackOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-[2rem] shadow-2xl overflow-hidden"
            >
              <div className="p-8 md:p-10">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-[#004A99]">
                      <MessageSquare className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold">Kirim Feedback</h3>
                      <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Saran & Kritik Anda</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setIsFeedbackOpen(false)}
                    className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                  >
                    <X className="w-5 h-5 text-slate-400" />
                  </button>
                </div>

                {isFeedbackSubmitted ? (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="py-12 text-center"
                  >
                    <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
                      <CheckCircle2 className="w-10 h-10" />
                    </div>
                    <h4 className="text-2xl font-bold mb-2">Terima Kasih!</h4>
                    <p className="text-slate-500">Feedback Anda sangat berharga bagi kami untuk terus meningkatkan layanan BWS.</p>
                  </motion.div>
                ) : (
                  <form onSubmit={submitFeedback} className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Nama (Opsional)</label>
                        <input 
                          type="text" 
                          value={feedbackName}
                          onChange={(e) => setFeedbackName(e.target.value)}
                          placeholder="Nama Anda"
                          className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm focus:bg-white focus:ring-2 focus:ring-[#004A99] transition-all"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Email (Opsional)</label>
                        <input 
                          type="email" 
                          value={feedbackEmail}
                          onChange={(e) => setFeedbackEmail(e.target.value)}
                          placeholder="email@anda.com"
                          className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm focus:bg-white focus:ring-2 focus:ring-[#004A99] transition-all"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Komentar / Saran</label>
                      <textarea 
                        required
                        value={feedbackText}
                        onChange={(e) => setFeedbackText(e.target.value)}
                        placeholder="Tuliskan pengalaman atau saran Anda untuk situs BWS Call ini..."
                        rows={5}
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-4 text-sm focus:bg-white focus:ring-2 focus:ring-[#004A99] transition-all resize-none"
                      />
                    </div>
                    <button 
                      type="submit"
                      disabled={isSubmittingFeedback || !feedbackText.trim()}
                      className="w-full py-4 bg-[#004A99] text-white rounded-xl font-bold hover:bg-[#003d7e] disabled:bg-slate-300 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-3 shadow-lg shadow-blue-200"
                    >
                      {isSubmittingFeedback ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          Memproses...
                        </>
                      ) : (
                        <>
                          Kirim Sekarang
                          <ChevronRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </form>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
