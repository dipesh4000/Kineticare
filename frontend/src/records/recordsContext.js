import { createContext, useContext } from 'react';

export const RecordsContext = createContext(null);
export const useRecords = () => useContext(RecordsContext);
