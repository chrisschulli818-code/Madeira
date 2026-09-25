import { ClipboardList, LayoutGrid, ListChecks, Wrench } from 'lucide-react';
import { ProjectResultsProvider, useResults } from '@/hooks/ProjectResults';
import { Header } from '@/components/layout/Header';
import { ParameterPanel } from '@/components/params/ParameterPanel';
import { Viewport } from '@/components/viewport/Viewport';
import { CutListTable } from '@/components/cutlist/CutListTable';
import { CuttingPlan } from '@/components/nesting/CuttingPlan';
import { HardwareSummary } from '@/components/hardware/HardwareSummary';
import { ToolChecklist } from '@/components/tools/ToolChecklist';
import { PrintReport } from '@/components/report/PrintReport';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

function ResultsTabs() {
  const { model, nesting, hardware, tools } = useResults();
  const sheets = nesting.reduce((n, g) => n + g.sheets.length, 0);
  const essentials = tools.filter((t) => t.category === 'obrigatoria').length;
  const count = (n: number) => <span className="rounded bg-border/70 px-1.5 text-[10px] tabular-nums">{n}</span>;

  return (
    <Card className="flex h-[640px] min-h-0 flex-col overflow-hidden lg:h-auto lg:flex-1">
      <Tabs defaultValue="cutlist" className="flex min-h-0 flex-1 flex-col">
        <div className="overflow-x-auto border-b border-border px-3 py-2">
          <TabsList>
            <TabsTrigger value="cutlist">
              <ClipboardList /> Lista de corte {count(model.pieces.reduce((n, p) => n + p.quantity, 0))}
            </TabsTrigger>
            <TabsTrigger value="nesting">
              <LayoutGrid /> Plano de corte {count(sheets)}
            </TabsTrigger>
            <TabsTrigger value="hardware">
              <Wrench /> Insumos {count(hardware.length)}
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
        <TabsContent value="tools" className="min-h-0 flex-1">
          <ToolChecklist />
        </TabsContent>
      </Tabs>
    </Card>
  );
}

export default function App() {
  return (
    <ProjectResultsProvider>
      <div className="flex min-h-full flex-col print:hidden lg:h-full">
        <Header />
        <div className="flex-1 lg:grid lg:min-h-0 lg:grid-cols-[340px_1fr]">
          <ParameterPanel />
          <main className="flex flex-col gap-3 p-3 lg:min-h-0">
            <div className="h-[420px] lg:h-auto lg:min-h-0 lg:flex-1">
              <Viewport />
            </div>
            <ResultsTabs />
          </main>
        </div>
      </div>
      <PrintReport />
    </ProjectResultsProvider>
  );
}
