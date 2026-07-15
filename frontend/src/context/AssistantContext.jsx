import { createContext, useContext, useState, useEffect } from "react";

const AssistantContext = createContext();

export function AssistantProvider({ children }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [input, setInput] = useState("");
  const [selectedCircularId, setSelectedCircularId] = useState(null);
  const [hasNewAlerts, setHasNewAlerts] = useState(true); // default true for first-time login suggestions

  const triggerAskAI = (prompt, circularId = null) => {
    setInput(prompt);
    if (circularId) {
      setSelectedCircularId(circularId);
    }
    setIsOpen(true);
    setIsMinimized(false);
  };

  const closeAssistant = () => {
    setIsOpen(false);
    setIsMinimized(false);
  };

  const minimizeAssistant = () => {
    setIsMinimized(true);
  };

  const restoreAssistant = () => {
    setIsMinimized(false);
    setIsOpen(true);
  };

  return (
    <AssistantContext.Provider value={{ 
      isOpen, 
      setIsOpen, 
      isMinimized, 
      setIsMinimized,
      input, 
      setInput,
      selectedCircularId,
      setSelectedCircularId,
      triggerAskAI,
      closeAssistant,
      minimizeAssistant,
      restoreAssistant,
      hasNewAlerts,
      setHasNewAlerts
    }}>
      {children}
    </AssistantContext.Provider>
  );
}

export function useAssistant() {
  return useContext(AssistantContext);
}
