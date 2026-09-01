import { createContext, useContext, useState, type PropsWithChildren } from 'react';

import type { BookingDraft, PaymentMethod, Provider } from './types';

type BookingContextValue = BookingDraft & {
  fee: number;
  selectProvider: (provider: Provider) => void;
  selectDate: (date: Date) => void;
  selectTime: (time: string) => void;
  selectPaymentMethod: (method: PaymentMethod) => void;
  setBookingId: (bookingId: string) => void;
  resetBooking: () => void;
};

const initialDraft: BookingDraft = {
  provider: null,
  selectedDate: null,
  selectedTime: null,
  paymentMethod: null,
  bookingId: null,
};

const BookingContext = createContext<BookingContextValue | null>(null);

export function BookingProvider({ children }: PropsWithChildren) {
  const [draft, setDraft] = useState<BookingDraft>(initialDraft);
  const fee = draft.provider?.consultationFee ?? 0;

  return (
    <BookingContext.Provider
      value={{
        ...draft,
        fee,
        selectProvider: (provider) => setDraft((value) => ({ ...value, provider })),
        selectDate: (selectedDate) => setDraft((value) => ({ ...value, selectedDate, selectedTime: null })),
        selectTime: (selectedTime) => setDraft((value) => ({ ...value, selectedTime })),
        selectPaymentMethod: (paymentMethod) => setDraft((value) => ({ ...value, paymentMethod })),
        setBookingId: (bookingId) => setDraft((value) => ({ ...value, bookingId })),
        resetBooking: () => setDraft(initialDraft),
      }}>
      {children}
    </BookingContext.Provider>
  );
}

export function useBooking() {
  const value = useContext(BookingContext);
  if (!value) throw new Error('useBooking must be used inside BookingProvider');
  return value;
}
