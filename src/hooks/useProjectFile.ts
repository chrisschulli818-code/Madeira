import { useProjectStore } from '@/store/projectStore';
import { parseProjectFile, PROJECT_FILE_EXTENSION, serializeProject } from '@/engine/projectFile';
import { downloadFile, slugify } from '@/lib/utils';

/** Salvar o projeto em arquivo, abrir um arquivo salvo e começar um projeto novo. */
export function useProjectFile() {
  const loadProject = useProjectStore((s) => s.loadProject);
  const newProjectAction = useProjectStore((s) => s.newProject);

  const saveProject = () => {
    const { projectName, items, sheet, materials, services, prices, room, placements } = useProjectStore.getState();
    downloadFile(
      `${slugify(projectName)}${PROJECT_FILE_EXTENSION}`,
      serializeProject({ projectName, items, sheet, materials, services, prices, room, placements }),
      'application/json',
      false,
    );
  };

  const openProject = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const result = parseProjectFile(await file.text());
      if (!result.ok) {
        alert(`Não foi possível abrir "${file.name}": ${result.error}`);
        return;
      }
      if (confirm(`Abrir "${result.data.projectName}"? O projeto atual será substituído (salve-o antes, se precisar).`)) {
        loadProject(result.data);
      }
    };
    input.click();
  };

  const newProject = (fromScratch = false) => {
    const what = fromScratch ? 'um projeto do zero, com a tela em branco' : 'um projeto novo';
    if (confirm(`Começar ${what}? O projeto atual será descartado (salve-o antes, se precisar).`)) newProjectAction(fromScratch);
  };

  return { saveProject, openProject, newProject };
}
