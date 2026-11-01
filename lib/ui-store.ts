"use client";
/*
 * Zustand : état d'interface partagé entre composants (sans le faire passer
 * de parent en enfant). Uniquement de l'état d'écran, jamais de données
 * sensibles : rien n'est enregistré dans le navigateur.
 */
import { create } from "zustand";

type UiState = {
  /** Menu latéral du personnel ouvert (tablette, téléphone). */
  staffMenuOpen: boolean;
  openStaffMenu: () => void;
  closeStaffMenu: () => void;
};

export const useUiStore = create<UiState>((set) => ({
  staffMenuOpen: false,
  openStaffMenu: () => set({ staffMenuOpen: true }),
  closeStaffMenu: () => set({ staffMenuOpen: false }),
}));
