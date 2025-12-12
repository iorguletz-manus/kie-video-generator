import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface CreateItemDialogProps {
  open: boolean;
  type: 'tam' | 'coreBelief' | 'emotionalAngle' | 'ad' | 'character' | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: (name: string) => void;
}

const TYPE_CONFIG = {
  tam: {
    title: 'Create New TAM',
    label: 'TAM name',
    placeholder: 'Enter TAM name',
  },
  coreBelief: {
    title: 'Create New Core Belief',
    label: 'Core Belief name',
    placeholder: 'Enter Core Belief name',
  },
  emotionalAngle: {
    title: 'Create New Emotional Angle',
    label: 'Emotional Angle name',
    placeholder: 'Enter Emotional Angle name',
  },
  ad: {
    title: 'Create New AD',
    label: 'AD name',
    placeholder: 'Enter AD name',
  },
  character: {
    title: 'Create New Character',
    label: 'Character name',
    placeholder: 'Enter Character name',
  },
};

export function CreateItemDialog({
  open,
  type,
  onOpenChange,
  onConfirm,
}: CreateItemDialogProps) {
  const [name, setName] = useState('');

  const handleConfirm = () => {
    if (name.trim()) {
      onConfirm(name.trim());
      setName(''); // Reset for next time
      onOpenChange(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleConfirm();
    }
  };

  const config = type ? TYPE_CONFIG[type] : null;
  
  if (!config) return null;
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{config.title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">{config.label}</Label>
            <Input
              id="name"
              placeholder={config.placeholder}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={!name.trim()}>
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
