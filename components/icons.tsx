/**
 * ICÔNES DE L'APPLICATION — Papicons (@getpapillon/papicons, MIT).
 * Fichier GÉNÉRÉ : chaque nom (repris de lucide, pour ne rien changer dans les écrans)
 * pointe vers l'icône Papicons la plus proche. Les rares icônes sans équivalent
 * (chargement qui tourne, œil, copier, ciseaux, balance) restent celles de lucide.
 * Pour changer une icône partout : modifier la correspondance ici, pas dans les pages.
 */
import type { ComponentType, SVGProps } from "react";
import {
  Add as P_Add, AlertCircle as P_AlertCircle, AlertTriangle as P_AlertTriangle, Archive as P_Archive, ArrowDownBox as P_ArrowDownBox, ArrowLeft as P_ArrowLeft, ArrowRight as P_ArrowRight, ArrowRightUp as P_ArrowRightUp, ArrowUpBox as P_ArrowUpBox, Bell as P_Bell, Bus as P_Bus, Calendar as P_Calendar, Camera as P_Camera, Card as P_Card, Check as P_Check, ChevronDown as P_ChevronDown, ChevronLeft as P_ChevronLeft, ChevronRight as P_ChevronRight, ChevronUp as P_ChevronUp, Clock as P_Clock, Cross as P_Cross, Crown as P_Crown, Dots as P_Dots, ExternalLink as P_ExternalLink, Filter as P_Filter, Folder as P_Folder, Gallery as P_Gallery, Gears as P_Gears, Grid as P_Grid, Home as P_Home, Info as P_Info, Link as P_Link, Lock as P_Lock, Login as P_Login, Logout as P_Logout, Mail as P_Mail, MapPin as P_MapPin, Newspaper as P_Newspaper, Paper as P_Paper, Password as P_Password, Pen as P_Pen, PenAlt as P_PenAlt, Phone as P_Phone, Pie as P_Pie, PiggyBank as P_PiggyBank, Pillar as P_Pillar, Play as P_Play, Plus as P_Plus, QrCode as P_QrCode, Search as P_Search, Sparkles as P_Sparkles, Star as P_Star, Tasks as P_Tasks, TextBubble as P_TextBubble, Trash as P_Trash, Unlock as P_Unlock, User as P_User, Volume as P_Volume
} from "@getpapillon/papicons";
import {
  Loader2 as LucideLoader2, LoaderCircle as LucideLoaderCircle, RefreshCw as LucideRefreshCw, RotateCcw as LucideRotateCcw, Eye as LucideEye, EyeOff as LucideEyeOff, Copy as LucideCopy, Scissors as LucideScissors, Scale as LucideScale
} from "lucide-react";

export type IconProps = Omit<SVGProps<SVGSVGElement>, "ref"> & { size?: number | string; strokeWidth?: number | string; absoluteStrokeWidth?: boolean; color?: string };
export type IconComponent = ComponentType<IconProps>;
/** Compatibilité : ancien type des icônes lucide. */
export type LucideIcon = IconComponent;

// Papicons sont pleines (fill) : l'épaisseur de trait de lucide n'a pas de sens, on l'écarte.
function papi(Source: ComponentType<Record<string, unknown>>, name: string): IconComponent {
  const Icon = ({ strokeWidth: _stroke, absoluteStrokeWidth: _abs, size, ...props }: IconProps) => <Source aria-hidden="true" {...props} size={size === undefined ? undefined : Number(size)} />;
  Icon.displayName = name;
  return Icon;
}
function keep(Source: ComponentType<Record<string, unknown>>, name: string): IconComponent {
  const Icon = (props: IconProps) => <Source {...props} />;
  Icon.displayName = name;
  return Icon;
}

export const CheckCircle2 = papi(P_Check as ComponentType<Record<string, unknown>>, "CheckCircle2");
export const CircleCheck = papi(P_Check as ComponentType<Record<string, unknown>>, "CircleCheck");
export const CheckCheck = papi(P_Check as ComponentType<Record<string, unknown>>, "CheckCheck");
export const CheckSquare = papi(P_Check as ComponentType<Record<string, unknown>>, "CheckSquare");
export const Check = papi(P_Check as ComponentType<Record<string, unknown>>, "Check");
export const X = papi(P_Cross as ComponentType<Record<string, unknown>>, "X");
export const XCircle = papi(P_Cross as ComponentType<Record<string, unknown>>, "XCircle");
export const Ban = papi(P_Cross as ComponentType<Record<string, unknown>>, "Ban");
export const FileText = papi(P_Paper as ComponentType<Record<string, unknown>>, "FileText");
export const ReceiptText = papi(P_Paper as ComponentType<Record<string, unknown>>, "ReceiptText");
export const Receipt = papi(P_Paper as ComponentType<Record<string, unknown>>, "Receipt");
export const Printer = papi(P_Paper as ComponentType<Record<string, unknown>>, "Printer");
export const FileSignature = papi(P_PenAlt as ComponentType<Record<string, unknown>>, "FileSignature");
export const ArrowLeft = papi(P_ArrowLeft as ComponentType<Record<string, unknown>>, "ArrowLeft");
export const ArrowRight = papi(P_ArrowRight as ComponentType<Record<string, unknown>>, "ArrowRight");
export const Navigation = papi(P_ArrowRightUp as ComponentType<Record<string, unknown>>, "Navigation");
export const Send = papi(P_ArrowRightUp as ComponentType<Record<string, unknown>>, "Send");
export const Share = papi(P_ExternalLink as ComponentType<Record<string, unknown>>, "Share");
export const ExternalLink = papi(P_ExternalLink as ComponentType<Record<string, unknown>>, "ExternalLink");
export const Truck = papi(P_Bus as ComponentType<Record<string, unknown>>, "Truck");
export const Route = papi(P_MapPin as ComponentType<Record<string, unknown>>, "Route");
export const MapPin = papi(P_MapPin as ComponentType<Record<string, unknown>>, "MapPin");
export const MapPinned = papi(P_MapPin as ComponentType<Record<string, unknown>>, "MapPinned");
export const Trash2 = papi(P_Trash as ComponentType<Record<string, unknown>>, "Trash2");
export const Users = papi(P_User as ComponentType<Record<string, unknown>>, "Users");
export const UsersRound = papi(P_User as ComponentType<Record<string, unknown>>, "UsersRound");
export const UserRound = papi(P_User as ComponentType<Record<string, unknown>>, "UserRound");
export const UserCheck = papi(P_User as ComponentType<Record<string, unknown>>, "UserCheck");
export const UserPlus = papi(P_User as ComponentType<Record<string, unknown>>, "UserPlus");
export const User = papi(P_User as ComponentType<Record<string, unknown>>, "User");
export const PackageCheck = papi(P_Archive as ComponentType<Record<string, unknown>>, "PackageCheck");
export const Package = papi(P_Archive as ComponentType<Record<string, unknown>>, "Package");
export const PackageX = papi(P_Archive as ComponentType<Record<string, unknown>>, "PackageX");
export const PackagePlus = papi(P_Archive as ComponentType<Record<string, unknown>>, "PackagePlus");
export const Boxes = papi(P_Archive as ComponentType<Record<string, unknown>>, "Boxes");
export const Inbox = papi(P_Archive as ComponentType<Record<string, unknown>>, "Inbox");
export const Archive = papi(P_Archive as ComponentType<Record<string, unknown>>, "Archive");
export const ShoppingBag = papi(P_Archive as ComponentType<Record<string, unknown>>, "ShoppingBag");
export const PackageSearch = papi(P_Search as ComponentType<Record<string, unknown>>, "PackageSearch");
export const FileSearch = papi(P_Search as ComponentType<Record<string, unknown>>, "FileSearch");
export const Search = papi(P_Search as ComponentType<Record<string, unknown>>, "Search");
export const Warehouse = papi(P_Home as ComponentType<Record<string, unknown>>, "Warehouse");
export const Store = papi(P_Home as ComponentType<Record<string, unknown>>, "Store");
export const Building2 = papi(P_Home as ComponentType<Record<string, unknown>>, "Building2");
export const Home = papi(P_Home as ComponentType<Record<string, unknown>>, "Home");
export const ClipboardList = papi(P_Tasks as ComponentType<Record<string, unknown>>, "ClipboardList");
export const ClipboardCheck = papi(P_Tasks as ComponentType<Record<string, unknown>>, "ClipboardCheck");
export const Clipboard = papi(P_Tasks as ComponentType<Record<string, unknown>>, "Clipboard");
export const Download = papi(P_ArrowDownBox as ComponentType<Record<string, unknown>>, "Download");
export const FileDown = papi(P_ArrowDownBox as ComponentType<Record<string, unknown>>, "FileDown");
export const Upload = papi(P_ArrowUpBox as ComponentType<Record<string, unknown>>, "Upload");
export const ShieldCheck = papi(P_Lock as ComponentType<Record<string, unknown>>, "ShieldCheck");
export const Lock = papi(P_Lock as ComponentType<Record<string, unknown>>, "Lock");
export const ShieldOff = papi(P_Unlock as ComponentType<Record<string, unknown>>, "ShieldOff");
export const KeyRound = papi(P_Password as ComponentType<Record<string, unknown>>, "KeyRound");
export const MessageCircle = papi(P_TextBubble as ComponentType<Record<string, unknown>>, "MessageCircle");
export const MessageSquareText = papi(P_TextBubble as ComponentType<Record<string, unknown>>, "MessageSquareText");
export const Mail = papi(P_Mail as ComponentType<Record<string, unknown>>, "Mail");
export const ChevronRight = papi(P_ChevronRight as ComponentType<Record<string, unknown>>, "ChevronRight");
export const ChevronLeft = papi(P_ChevronLeft as ComponentType<Record<string, unknown>>, "ChevronLeft");
export const ChevronDown = papi(P_ChevronDown as ComponentType<Record<string, unknown>>, "ChevronDown");
export const ChevronUp = papi(P_ChevronUp as ComponentType<Record<string, unknown>>, "ChevronUp");
export const Plus = papi(P_Plus as ComponentType<Record<string, unknown>>, "Plus");
export const SquarePlus = papi(P_Add as ComponentType<Record<string, unknown>>, "SquarePlus");
export const ImagePlus = papi(P_Gallery as ComponentType<Record<string, unknown>>, "ImagePlus");
export const Image = papi(P_Gallery as ComponentType<Record<string, unknown>>, "Image");
export const Clock = papi(P_Clock as ComponentType<Record<string, unknown>>, "Clock");
export const Clock3 = papi(P_Clock as ComponentType<Record<string, unknown>>, "Clock3");
export const History = papi(P_Clock as ComponentType<Record<string, unknown>>, "History");
export const CalendarClock = papi(P_Clock as ComponentType<Record<string, unknown>>, "CalendarClock");
export const CalendarRange = papi(P_Calendar as ComponentType<Record<string, unknown>>, "CalendarRange");
export const CalendarDays = papi(P_Calendar as ComponentType<Record<string, unknown>>, "CalendarDays");
export const CircleDollarSign = papi(P_PiggyBank as ComponentType<Record<string, unknown>>, "CircleDollarSign");
export const HandCoins = papi(P_PiggyBank as ComponentType<Record<string, unknown>>, "HandCoins");
export const Wallet = papi(P_PiggyBank as ComponentType<Record<string, unknown>>, "Wallet");
export const WalletCards = papi(P_Card as ComponentType<Record<string, unknown>>, "WalletCards");
export const DollarSign = papi(P_Card as ComponentType<Record<string, unknown>>, "DollarSign");
export const BadgeDollarSign = papi(P_Card as ComponentType<Record<string, unknown>>, "BadgeDollarSign");
export const Banknote = papi(P_Card as ComponentType<Record<string, unknown>>, "Banknote");
export const CreditCard = papi(P_Card as ComponentType<Record<string, unknown>>, "CreditCard");
export const IdCard = papi(P_Card as ComponentType<Record<string, unknown>>, "IdCard");
export const Landmark = papi(P_Pillar as ComponentType<Record<string, unknown>>, "Landmark");
export const Bell = papi(P_Bell as ComponentType<Record<string, unknown>>, "Bell");
export const BellRing = papi(P_Bell as ComponentType<Record<string, unknown>>, "BellRing");
export const Megaphone = papi(P_Volume as ComponentType<Record<string, unknown>>, "Megaphone");
export const AlertTriangle = papi(P_AlertTriangle as ComponentType<Record<string, unknown>>, "AlertTriangle");
export const AlertCircle = papi(P_AlertCircle as ComponentType<Record<string, unknown>>, "AlertCircle");
export const HelpCircle = papi(P_Info as ComponentType<Record<string, unknown>>, "HelpCircle");
export const CircleHelp = papi(P_Info as ComponentType<Record<string, unknown>>, "CircleHelp");
export const Settings = papi(P_Gears as ComponentType<Record<string, unknown>>, "Settings");
export const SlidersHorizontal = papi(P_Filter as ComponentType<Record<string, unknown>>, "SlidersHorizontal");
export const Filter = papi(P_Filter as ComponentType<Record<string, unknown>>, "Filter");
export const Pencil = papi(P_Pen as ComponentType<Record<string, unknown>>, "Pencil");
export const LogOut = papi(P_Logout as ComponentType<Record<string, unknown>>, "LogOut");
export const LogIn = papi(P_Login as ComponentType<Record<string, unknown>>, "LogIn");
export const Sparkles = papi(P_Sparkles as ComponentType<Record<string, unknown>>, "Sparkles");
export const Star = papi(P_Star as ComponentType<Record<string, unknown>>, "Star");
export const Trophy = papi(P_Crown as ComponentType<Record<string, unknown>>, "Trophy");
export const Gift = papi(P_Crown as ComponentType<Record<string, unknown>>, "Gift");
export const Calculator = papi(P_Grid as ComponentType<Record<string, unknown>>, "Calculator");
export const FileSpreadsheet = papi(P_Grid as ComponentType<Record<string, unknown>>, "FileSpreadsheet");
export const LayoutDashboard = papi(P_Grid as ComponentType<Record<string, unknown>>, "LayoutDashboard");
export const Puzzle = papi(P_Grid as ComponentType<Record<string, unknown>>, "Puzzle");
export const TrendingUp = papi(P_Pie as ComponentType<Record<string, unknown>>, "TrendingUp");
export const BarChart3 = papi(P_Pie as ComponentType<Record<string, unknown>>, "BarChart3");
export const ChartNoAxesCombined = papi(P_Pie as ComponentType<Record<string, unknown>>, "ChartNoAxesCombined");
export const Phone = papi(P_Phone as ComponentType<Record<string, unknown>>, "Phone");
export const Smartphone = papi(P_Phone as ComponentType<Record<string, unknown>>, "Smartphone");
export const Camera = papi(P_Camera as ComponentType<Record<string, unknown>>, "Camera");
export const CameraOff = papi(P_Camera as ComponentType<Record<string, unknown>>, "CameraOff");
export const Video = papi(P_Play as ComponentType<Record<string, unknown>>, "Video");
export const BookOpen = papi(P_Newspaper as ComponentType<Record<string, unknown>>, "BookOpen");
export const ScanLine = papi(P_QrCode as ComponentType<Record<string, unknown>>, "ScanLine");
export const Link2 = papi(P_Link as ComponentType<Record<string, unknown>>, "Link2");
export const EllipsisVertical = papi(P_Dots as ComponentType<Record<string, unknown>>, "EllipsisVertical");
export const MoreHorizontal = papi(P_Dots as ComponentType<Record<string, unknown>>, "MoreHorizontal");
export const Folder = papi(P_Folder as ComponentType<Record<string, unknown>>, "Folder");
export const FolderOpen = papi(P_Folder as ComponentType<Record<string, unknown>>, "FolderOpen");
export const Loader2 = keep(LucideLoader2 as unknown as ComponentType<Record<string, unknown>>, "Loader2");
export const LoaderCircle = keep(LucideLoaderCircle as unknown as ComponentType<Record<string, unknown>>, "LoaderCircle");
export const RefreshCw = keep(LucideRefreshCw as unknown as ComponentType<Record<string, unknown>>, "RefreshCw");
export const RotateCcw = keep(LucideRotateCcw as unknown as ComponentType<Record<string, unknown>>, "RotateCcw");
export const Eye = keep(LucideEye as unknown as ComponentType<Record<string, unknown>>, "Eye");
export const EyeOff = keep(LucideEyeOff as unknown as ComponentType<Record<string, unknown>>, "EyeOff");
export const Copy = keep(LucideCopy as unknown as ComponentType<Record<string, unknown>>, "Copy");
export const Scissors = keep(LucideScissors as unknown as ComponentType<Record<string, unknown>>, "Scissors");
export const Scale = keep(LucideScale as unknown as ComponentType<Record<string, unknown>>, "Scale");
