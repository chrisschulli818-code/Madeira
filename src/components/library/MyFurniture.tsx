/**
 * "Meus móveis": biblioteca pessoal de móveis projetados, salva no navegador.
 * Permite colocar um móvel salvo no projeto/ambiente atual e importar móveis de um projeto salvo (.woodcraft.json).
 */
import { useMemo } from 'react';
import { FileUp, Plus, Trash2 } from 'lucide-react';
import { useProjectStore } from '@/store/projectStore';
import { buildItemModel } from '@/engine/projectEngine';
import { furnitureExtent } from '@/engine/roomEngine';
import { parseProjectFile } from '@/engine/projectFile';
import { TEMPLATES } from '@/engine/templates';
import { Button } from '@/components/ui/button';
import { TEMPLATE_ICONS } from '@/components/layout/ProjectItemsBar';
import type { LibraryEntry } from '@/types/woodcraft';

/** Abre um .woodcraft.json e guarda os móveis dele em "Meus móveis". */
export function useImportToLibrary() {
  const addToLibrary = useProjectStore((s) => s.addToLibrary);
  return () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const result = parseProjectFile(await file.text());
      if (!result.ok) {
        alert(`Não foi possível ler "${file.name}": ${result.error}`);
        return;
      }
      const n = addToLibrary(result.data.items);
      alert(`${n} móvel(is) de "${result.data.projectName}" foram adicionados a "Meus móveis".`);
    };
    input.click();
  };
}

function EntryRow({ entry, onPlace }: { entry: LibraryEntry; onPlace: () => void }) {
  const removeFromLibrary = useProjectStore((s) => s.removeFromLibrary);
  const size = useMemo(() => furnitureExtent(buildItemModel(entry.item)).size, [entry.item]);
  return (
    <div className="flex items-center gap-2 rounded-md border border-border bg-background px-2 py-1.5">
      <span className="text-primary [&_svg]:size-4">{TEMPLATE_ICONS[entry.item.templateId]}</span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{entry.item.name}</div>
        <div className="truncate text-[11px] text-subtle">
          {TEMPLATES[entry.item.templateId].name} · {Math.round(size.w)} × {Math.round(size.h)} × {Math.round(size.d)} mm
        </div>
      </div>
      <Button size="sm" className="h-7 px-2" onClick={onPlace} title="Colocar uma cópia deste móvel no projeto">
        <Plus /> Colocar
      </Button>
      <button
        type="button"
        aria-label={`Remover ${entry.item.name} de Meus móveis`}
        onClick={() => confirm(`Remover "${entry.item.name}" de Meus móveis?`) && removeFromLibrary(entry.id)}
        className="grid size-7 place-items-center rounded text-subtle hover:bg-muted hover:text-danger"
      >
        <Trash2 className="size-3.5" />
      </button>
    </div>
  );
}

export function MyFurniture({ onPlaced }: { onPlaced?: () => void }) {
  const library = useProjectStore((s) => s.library);
  const insertItems = useProjectStore((s) => s.insertItems);
  const importToLibrary = useImportToLibrary();

  return (
    <div className="space-y-2">
      {library.length === 0 ? (
        <p className="rounded-md border border-dashed border-border bg-background p-3 text-xs leading-snug text-subtle">
          Nenhum móvel salvo ainda. No editor de um móvel, clique no ícone de marcador (🔖) para guardá-lo aqui, ou importe
          os móveis de um projeto salvo.
        </p>
      ) : (
        library.map((entry) => (
          <EntryRow
            key={entry.id}
            entry={entry}
            onPlace={() => {
              insertItems([entry.item]);
              onPlaced?.();
            }}
          />
        ))
      )}
      <Button variant="outline" size="sm" className="w-full" onClick={importToLibrary}>
        <FileUp /> Importar móveis de um projeto salvo
      </Button>
    </div>
  );
}
