import { Archive, ChevronDown, FileDown, FilePlus2, FolderOpen, Loader2, Maximize2, PencilRuler, Printer, Save } from 'lucide-react';
import { useProjectStore } from '@/store/projectStore';
import { Button } from '@/components/ui/button';
import { useExportPdf } from '@/hooks/useExportPdf';
import { useProjectFile } from '@/hooks/useProjectFile';
import { useExpanded } from '@/hooks/useExpanded';
import { Dropdown, MenuItem } from '@/components/ui/dropdown';

export function Header() {
  const projectName = useProjectStore((s) => s.projectName);
  const setProjectName = useProjectStore((s) => s.setProjectName);
  const { exportPdf, exporting } = useExportPdf();
  const { saveProject, openProject, newProject } = useProjectFile();
  const { toggle: toggleExpanded } = useExpanded();

  return (
    <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border bg-surface px-4 py-2.5">
      <div className="flex min-w-0 items-center gap-2">
        <img src="/favicon.svg" alt="" className="size-7" />
        <div className="min-w-0 leading-tight">
          <div className="text-sm font-bold tracking-tight">WoodCraft Planner</div>
          <input
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            aria-label="Nome do projeto"
            className="w-44 rounded border border-transparent bg-transparent text-xs text-subtle hover:border-border focus:border-primary focus:outline-none"
          />
        </div>
      </div>

      <div className="ml-auto flex flex-wrap items-center gap-1.5">
        <Dropdown
          align="right"
          trigger={({ open, toggle }) => (
            <Button variant="ghost" size="sm" onClick={toggle} aria-expanded={open} aria-haspopup="menu" title="Novo projeto">
              <FilePlus2 /> <span className="hidden md:inline">Novo</span> <ChevronDown className="!size-3" />
            </Button>
          )}
        >
          {(close) => (
            <>
              <MenuItem
                icon={<PencilRuler />}
                title="Do zero (tela limpa)"
                description="Tela em branco e expandida para montar o móvel peça por peça."
                onSelect={() => {
                  close();
                  newProject(true);
                }}
              />
              <MenuItem
                icon={<Archive />}
                title="A partir de um modelo"
                description="Começa com um balcão pronto para ajustar as medidas."
                onSelect={() => {
                  close();
                  newProject(false);
                }}
              />
            </>
          )}
        </Dropdown>
        <Button variant="ghost" size="sm" onClick={openProject} title="Abrir projeto salvo (.woodcraft.json)">
          <FolderOpen /> <span className="hidden md:inline">Abrir</span>
        </Button>
        <Button variant="ghost" size="sm" onClick={saveProject} title="Salvar o projeto em um arquivo">
          <Save /> <span className="hidden md:inline">Salvar</span>
        </Button>
        <Button variant="ghost" size="sm" onClick={() => toggleExpanded(true)} title="Tela expandida: só o editor e o 3D">
          <Maximize2 /> <span className="hidden md:inline">Expandir</span>
        </Button>
        <span className="mx-1 hidden h-6 w-px bg-border sm:block" />
        <Button variant="outline" size="sm" onClick={() => window.print()} title="Imprimir relatório">
          <Printer /> <span className="hidden lg:inline">Imprimir</span>
        </Button>
        <Button size="sm" onClick={exportPdf} disabled={exporting} title="Baixar o projeto completo em PDF">
          {exporting ? <Loader2 className="animate-spin" /> : <FileDown />} Exportar PDF
        </Button>
      </div>
    </header>
  );
}
