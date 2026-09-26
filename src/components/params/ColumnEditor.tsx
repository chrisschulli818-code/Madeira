import { Columns3, Plus, Trash2 } from 'lucide-react';
import { useProjectStore } from '@/store/projectStore';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import type { CabinetParams } from '@/types/woodcraft';
import { FieldRow, NumberInput, Segmented, Stepper } from './fields';

/** Editor dos vãos (colunas) da caixa: largura relativa, gavetas, portas, prateleiras e cabideiro. */
export function ColumnEditor({ params, showRod }: { params: CabinetParams; showRod: boolean }) {
  const updateColumn = useProjectStore((s) => s.updateColumn);
  const addColumn = useProjectStore((s) => s.addColumn);
  const removeColumn = useProjectStore((s) => s.removeColumn);

  return (
    <div className="space-y-3">
      <p className="text-[11px] leading-snug text-subtle">
        Cada vão é separado por uma divisória. Com gavetas e porta no mesmo vão, uma prateleira fixa separa as duas regiões — escolha se o gaveteiro fica em cima ou embaixo.
      </p>
      {params.columns.map((col, i) => (
        <div key={col.id} className="space-y-2.5 rounded-lg border border-border bg-background p-3">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-semibold">
              <Columns3 className="size-3.5 text-primary" /> Vão {i + 1}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 text-subtle hover:text-danger"
              disabled={params.columns.length <= 1}
              onClick={() => removeColumn(col.id)}
              aria-label={`Remover vão ${i + 1}`}
            >
              <Trash2 />
            </Button>
          </div>
          <FieldRow label="Largura relativa">
            <NumberInput
              value={col.widthRatio}
              onChange={(v) => updateColumn(col.id, { widthRatio: v })}
              min={0.2}
              max={5}
              step={0.1}
              unit="×"
              className="w-20"
              aria-label="Largura relativa"
            />
          </FieldRow>
          <FieldRow label="Gavetas">
            <Stepper value={col.drawers} max={6} onChange={(v) => updateColumn(col.id, { drawers: v })} aria-label="Gavetas" />
          </FieldRow>
          {col.drawers > 0 && col.doors > 0 && (
            <FieldRow label="Posição das gavetas">
              <Segmented
                aria-label="Posição das gavetas"
                value={col.drawerPosition ?? 'top'}
                onChange={(drawerPosition) => updateColumn(col.id, { drawerPosition })}
                options={[
                  { value: 'top', label: 'Em cima' },
                  { value: 'bottom', label: 'Embaixo' },
                ]}
              />
            </FieldRow>
          )}
          <FieldRow label="Portas">
            <Segmented
              aria-label="Portas"
              value={col.doors}
              onChange={(v) => updateColumn(col.id, { doors: v })}
              options={[
                { value: 0, label: 'Sem' },
                { value: 1, label: '1 folha' },
                { value: 2, label: '2 folhas' },
              ]}
            />
          </FieldRow>
          <FieldRow
            label="Prateleiras móveis"
            hint={col.shelfPositions ? 'Posições ajustadas à mão (arrastando no 3D ou na vista frontal).' : undefined}
          >
            <Stepper value={col.shelves} max={10} onChange={(v) => updateColumn(col.id, { shelves: v })} aria-label="Prateleiras" />
          </FieldRow>
          {col.shelfPositions && (
            <Button variant="ghost" size="sm" className="h-7 w-full text-xs" onClick={() => updateColumn(col.id, { shelfPositions: undefined })}>
              Redistribuir prateleiras igualmente
            </Button>
          )}
          {showRod && (
            <FieldRow label="Cabideiro">
              <Switch checked={col.hangingRod} onCheckedChange={(v) => updateColumn(col.id, { hangingRod: v })} aria-label="Cabideiro" />
            </FieldRow>
          )}
        </div>
      ))}
      <Button variant="outline" size="sm" className="w-full" onClick={addColumn}>
        <Plus /> Adicionar vão
      </Button>
    </div>
  );
}
