import { useCallback, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ButtonComponent, FabComponent } from '@syncfusion/ej2-react-buttons';
import { AIAssistViewComponent } from '@syncfusion/ej2-react-interactive-chat';
import { Sparkles } from 'lucide-react';
import type { AIService } from '../ai/AIService';
import './ai-drawer.css';

export interface AIDrawerProps {
  service: AIService;
  context: string;
}

export function AIDrawer({ service, context }: AIDrawerProps) {
  const assistRef = useRef<AIAssistViewComponent | null>(null);
  const [open, setOpen] = useState(false);
  const suggestions = service.getSuggestions(context);

  const handlePrompt = useCallback((args: { prompt?: string }) => {
    const prompt = args.prompt?.trim();
    if (!prompt) return;
    void service.send({ prompt, context }).then(response => {
      assistRef.current?.addPromptResponse(response.text);
    });
  }, [service, context]);

  const root = typeof document === 'undefined' ? null : document.getElementById('root');
  const view = open ? (
    <div className="app-ai-drawer" role="dialog" aria-label="AI Assistant">
      <div className="app-ai-drawer__header">
        <strong>AI Assistant</strong>
        <ButtonComponent cssClass="e-flat e-small" aria-label="Close AI assistant" onClick={() => setOpen(false)}>Close</ButtonComponent>
      </div>
      <div className="app-ai-drawer__body">
        <AIAssistViewComponent
          ref={assistRef}
          cssClass="app-ai-assist"
          height="100%"
          width="100%"
          showHeader={false}
          promptSuggestions={suggestions}
          promptSuggestionsHeader="Suggested prompts"
          promptPlaceholder="Ask a question…"
          promptRequest={handlePrompt}
        />
      </div>
      <p className="app-ai-drawer__note">Simulated AI responses — not connected to a real model</p>
    </div>
  ) : (
    <FabComponent
      position="BottomRight"
      cssClass="app-fab"
      target={root ?? undefined}
      title="Ask AI"
      aria-label="Ask AI"
      onClick={() => setOpen(true)}
    >
      <Sparkles size={20} aria-hidden="true" />
    </FabComponent>
  );

  return root ? createPortal(view, root) : view;
}
