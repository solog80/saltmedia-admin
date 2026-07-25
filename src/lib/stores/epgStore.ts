import { create } from 'zustand';

interface EPGDialogState {
  // Dialog states
  addDialogOpen: boolean;
  editDialogOpen: boolean;
  deleteDialogOpen: boolean;

  // Form states
  selectedProgramIndex: number | null;
  selectedStation: string | null;

  // Pagination
  currentPage: number;

  // Image previews
  imagePreview: string | null;
  imageLandscapePreview: string | null;

  // Actions
  openAddDialog: () => void;
  closeAddDialog: () => void;
  openEditDialog: (stationName: string, programIndex: number) => void;
  closeEditDialog: () => void;
  openDeleteDialog: (stationName: string, programIndex: number) => void;
  closeDeleteDialog: () => void;

  setSelectedStation: (station: string | null) => void;
  setCurrentPage: (page: number) => void;
  resetCurrentPage: () => void;

  setImagePreview: (preview: string | null) => void;
  setImageLandscapePreview: (preview: string | null) => void;
  clearImagePreviews: () => void;
}

export const useEPGStore = create<EPGDialogState>((set) => ({
  // Initial states
  addDialogOpen: false,
  editDialogOpen: false,
  deleteDialogOpen: false,
  selectedProgramIndex: null,
  selectedStation: null,
  currentPage: 1,
  imagePreview: null,
  imageLandscapePreview: null,
  imageFileName: null,
  imageLandscapeFileName: null,

  // Actions
  openAddDialog: () => set({ addDialogOpen: true }),
  closeAddDialog: () => {
    set({ addDialogOpen: false, imagePreview: null, imageLandscapePreview: null, imageFileName: null, imageLandscapeFileName: null });
  },
  openEditDialog: (stationName, programIndex) => {
    set({ editDialogOpen: true, selectedStation: stationName, selectedProgramIndex: programIndex });
  },
  closeEditDialog: () => {
    set({ editDialogOpen: false, selectedProgramIndex: null, imagePreview: null, imageLandscapePreview: null, imageFileName: null, imageLandscapeFileName: null });
  },
  openDeleteDialog: (stationName, programIndex) => {
    set({ deleteDialogOpen: true, selectedStation: stationName, selectedProgramIndex: programIndex });
  },
  closeDeleteDialog: () => {
    set({ deleteDialogOpen: false, selectedProgramIndex: null });
  },

  setSelectedStation: (station) => {
    set({ selectedStation: station, currentPage: 1 });
  },
  setCurrentPage: (page) => set({ currentPage: page }),
  resetCurrentPage: () => set({ currentPage: 1 }),

  setImagePreview: (preview) => set({ imagePreview: preview }),
  setImageLandscapePreview: (preview) => set({ imageLandscapePreview: preview }),
  clearImagePreviews: () => set({ imagePreview: null, imageLandscapePreview: null }),
}));