import { EmptyWorkspace } from '../../components/common/EmptyWorkspace'
import { TopBar } from '../../components/layout/TopBar'
import { Cpu } from 'lucide-react'
import { Button } from '../../components/common/Button'
import React from 'react'

export function Home(): React.JSX.Element {
  return (
    <div className="flex flex-col h-full bg-background">
      <TopBar>
        <span className="font-semibold text-text-primary text-[14px] tracking-tight">
          Dashboard
        </span>
      </TopBar>
      <div className="flex-1 p-32 md:p-64 max-w-[900px] mx-auto w-full flex items-center">
        <EmptyWorkspace
          title="No board connected yet"
          description="The Dashboard will provide a high-level overview of your active project, connected hardware, and recent AI interactions. Connect an Arduino or ESP32 to begin."
          icon={<Cpu className="w-10 h-10 text-text-secondary/50" />}
          action={
            <Button size="md" variant="secondary" disabled>
              Detect Hardware
            </Button>
          }
        />
      </div>
    </div>
  )
}
