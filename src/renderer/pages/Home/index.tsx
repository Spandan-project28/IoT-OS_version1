import { EmptyWorkspace } from '../../components/common/EmptyWorkspace'
import { TopBar } from '../../components/layout/TopBar'
import { Cpu } from 'lucide-react'
import { Button } from '../../components/common/Button'
import React from 'react'

export function Home(): React.JSX.Element {
  return (
    <div className="flex flex-col h-full bg-background">
      <TopBar />
      <div className="flex-1 p-24 md:p-32 w-full flex items-center justify-center">
        <div className="w-full max-w-[800px]">
          <EmptyWorkspace
            title="No board connected yet"
            description="The Dashboard provides a high-level overview of your active project, connected hardware, and recent AI interactions. Connect an Arduino or ESP32 to begin."
            icon={<Cpu className="w-10 h-10 text-text-secondary/60" />}
            action={
              <Button size="lg" disabled>
                Detect Hardware
              </Button>
            }
          />
        </div>
      </div>
    </div>
  )
}
