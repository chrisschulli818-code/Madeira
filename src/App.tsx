import { ClipboardList, LayoutGrid, ListChecks, Wallet, Wrench } from 'lucide-react';
import { ProjectResultsProvider, useResults } from '@/hooks/ProjectResults';
import { Header } from '@/components/layout/Header';
import { ProjectItemsBar } from '@/components/layout/ProjectItemsBar';
import { ParameterPanel } from '@/components/params/ParameterPanel';
import { Viewport } from '@/components/viewport/Viewport';
import { CutListTable } from '@/components/cutlist/CutListTable';
import { CuttingPlan } from '@/components/nesting/CuttingPlan';
import { HardwareSummary } from '@/components/hardware/HardwareSummary';
import { ToolChecklist } from '@/components/tools/ToolChecklist';
import { BudgetPanel } from '@/components/budget/BudgetPanel';
import { PrintReport } from '@/components/report/PrintReport';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { fmtMoney } from '@/lib/utils';
import { useProjectStore } from '@/store/projectStore';
import { useExpandedShortcuts } from '@/hooks/useExpanded';

function ResultsTabs() {
  const { pieces, nesting, hardware, tools, budget } = useResults();
  const sheets = nesting.reduce((n, g) => n + g.sheets.length, 0);
  const essentials = tools.filter((t) => t.category === 'obrigatoria').length;
  const count = (n: number | string) => <span className="rounded bg-border/70 px-1.5 text-[10px] tabular-nums">{n}</span>;

  return (
    <Card className="flex h-[640px] min-h-0 flex-col overflow-hidden lg:h-full">
      <Tabs defaultValue="cutlist" className="flex min-h-0 flex-1 flex-col">
        <div className="overflow-x-auto border-b border-border px-3 py-2">
          <TabsList>
            <TabsTrigger value="cutlist">
              <ClipboardList /> Lista de corte {count(pieces.reduce((n, p) => n + p.quantity, 0))}
            </TabsTrigger>
            <TabsTrigger value="nesting">
              <LayoutGrid /> Plano de corte {count(sheets)}
            </TabsTrigger>
            <TabsTrigger value="hardware">
              <Wrench /> Insumos {count(hardware.length)}
            </TabsTrigger>
            <TabsTrigger value="budget">
              <Wallet /> Orçamento {count(fmtMoney(budget.price).replace(/,\d{2}$/, ''))}
            </TabsTrigger>
            <TabsTrigger value="tools">
              <ListChecks /> Ferramentas {count(essentials)}
            </TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="cutlist" className="min-h-0 flex-1">
          <CutListTable />
        </TabsContent>
        <TabsContent value="nesting" className="min-h-0 flex-1">
          <CuttingPlan />
        </TabsContent>
        <TabsContent value="hardware" className="min-h-0 flex-1">
          <HardwareSummary />
        </TabsContent>
        <TabsContent value="budget" className="min-h-0 flex-1">
          <BudgetPanel />
        </TabsContent>
        <TabsContent value="tools" className="min-h-0 flex-1">
          <ToolChecklist />
        </TabsContent>
      </Tabs>
    </Card>
  );
}

/**
 * Layout:
 * - Desktop (lg+): parâmetros à esquerda; viewport em cima e resultados embaixo à direita.
 * - Celular: viewport 3D primeiro, depois os parâmetros e por fim os resultados.
 */
export default function App() {
  useExpandedShortcuts();
  const expanded = useProjectStore((s) => s.expanded);

  return (
    <ProjectResultsProvider>
      {expanded ? (
        // Tela expandida (limpa): só o painel de edição e o viewport, ocupando a tela toda.
        <div className="flex h-full flex-col print:hidden lg:grid lg:grid-cols-[380px_1fr]">
          <div className="order-2 min-h-0 overflow-y-auto lg:order-1 lg:overflow-hidden">
            <ParameterPanel />
          </div>
          <div className="order-1 h-[60vh] p-2 lg:order-2 lg:h-full">
            <Viewport />
          </div>
        </div>
      ) : (
      <div className="flex min-h-full flex-col print:hidden lg:h-full">
        <Header />
        <ProjectItemsBar />
        <div className="flex flex-1 flex-col lg:grid lg:min-h-0 lg:grid-cols-[340px_1fr] lg:grid-rows-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="order-1 h-[380px] p-3 pb-0 sm:h-[440px] lg:col-start-2 lg:row-start-1 lg:h-auto lg:min-h-0 lg:pb-1.5">
            <Viewport />
          </div>
          <div className="order-2 mt-3 lg:col-start-1 lg:row-span-2 lg:row-start-1 lg:mt-0 lg:min-h-0">
            <ParameterPanel />
          </div>
          <div className="order-3 p-3 lg:col-start-2 lg:row-start-2 lg:min-h-0 lg:pt-1.5">
            <ResultsTabs />
          </div>
        </div>
      </div>
      )}
      <PrintReport />
    </ProjectResultsProvider>
  );
}
