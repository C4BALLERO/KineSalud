import { TREATMENT_CATEGORY_LABELS, type TreatmentCategory } from '@kinesalud/shared';
import { cn } from '@/utils/cn';
import { CATEGORY_CLASSES } from './visuals';

interface CategoryTagProps {
  category: TreatmentCategory;
  className?: string;
}

export function CategoryTag({ category, className }: CategoryTagProps) {
  const c = CATEGORY_CLASSES[category];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 text-caption font-medium whitespace-nowrap',
        c.text,
        className,
      )}
    >
      <span aria-hidden="true" className={cn('size-2 rounded-full', c.dot)} />
      {TREATMENT_CATEGORY_LABELS[category]}
    </span>
  );
}
