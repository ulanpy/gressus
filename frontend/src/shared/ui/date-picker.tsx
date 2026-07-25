import { useState } from 'react'
import { format } from 'date-fns'
import { CalendarIcon } from 'lucide-react'
import { useI18n } from '@/i18n/context'
import { cn } from '@/shared/lib/utils'
import { dateFnsLocale, formatIsoDate, parseIsoDate } from '@/shared/lib/dateInput'
import { Button } from '@/shared/ui/button'
import { Calendar } from '@/shared/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover'

type DatePickerProps = {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  id?: string
  clearLabel?: string
}

export function DatePicker({
  value,
  onChange,
  placeholder,
  disabled = false,
  className,
  id,
  clearLabel,
}: DatePickerProps) {
  const { language, t } = useI18n()
  const [open, setOpen] = useState(false)
  const selected = parseIsoDate(value)
  const locale = dateFnsLocale(language)
  const resolvedPlaceholder = placeholder ?? t.workflow.selectDate

  return (
    <Popover open={open} onOpenChange={setOpen} modal>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            'w-full justify-start text-left font-normal',
            !selected && 'text-muted-foreground',
            className,
          )}
        >
          <CalendarIcon className="mr-2 size-4 shrink-0 opacity-70" />
          {selected ? format(selected, 'PPP', { locale }) : resolvedPlaceholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="z-[100] w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={(date) => {
            if (date) {
              onChange(formatIsoDate(date))
              setOpen(false)
            }
          }}
          locale={locale}
          captionLayout="dropdown"
          startMonth={new Date(1920, 0)}
          endMonth={new Date(new Date().getFullYear() + 1, 11)}
          defaultMonth={selected}
        />
        {selected ? (
          <div className="border-t border-border p-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={() => {
                onChange('')
                setOpen(false)
              }}
            >
              {clearLabel ?? t.workflow.clearDate}
            </Button>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  )
}
