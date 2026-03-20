import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import type { DamageEvent } from '../../types';

const schema = z.object({
  name:        z.string().min(3, 'Name must be at least 3 characters').max(80),
  description: z.string().min(20, 'Description must be at least 20 characters').max(500),
  tags:        z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface EditEventModalProps {
  event:   DamageEvent | null;
  isOpen:  boolean;
  onClose: () => void;
  onSave:  (id: string, updates: Partial<DamageEvent>) => void;
}

export const EditEventModal: React.FC<EditEventModalProps> = ({ event, isOpen, onClose, onSave }) => {
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } =
    useForm<FormData>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (event) {
      reset({
        name:        event.name ?? '',
        description: event.description,
        tags:        event.tags?.join(', ') ?? '',
      });
    }
  }, [event, reset]);

  if (!event) return null;

  const onSubmit = (data: FormData) => {
    onSave(event.id, {
      name:        data.name,
      description: data.description,
      tags:        data.tags
        ? data.tags.split(',').map((t) => t.trim()).filter(Boolean)
        : [],
    });
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Edit Event — #${event.id.slice(-3)}`} size="md">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">

        <Input
          label="Event Name"
          {...register('name')}
          error={errors.name?.message}
        />

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">Description</label>
          <textarea
            {...register('description')}
            rows={4}
            className={`w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all resize-none
              ${errors.description ? 'border-red-400 bg-red-50' : 'border-gray-300 bg-white hover:border-gray-400'}`}
          />
          {errors.description && (
            <p className="text-xs text-red-600">{errors.description.message}</p>
          )}
        </div>

        <Input
          label="Tags (comma-separated)"
          placeholder="structural, urgent, gas"
          {...register('tags')}
        />

        <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={isSubmitting}>
            Save Changes
          </Button>
        </div>
      </form>
    </Modal>
  );
};
