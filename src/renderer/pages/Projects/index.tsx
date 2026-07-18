import { TopBar } from '../../components/layout/TopBar'
import { EmptyWorkspace } from '../../components/common/EmptyWorkspace'
import { Button } from '../../components/common/Button'
import { FolderPlus, Layers } from 'lucide-react'
import React from 'react'

export function Projects(): React.JSX.Element {
  return (
    <div className="flex flex-col h-full bg-background">
      <TopBar>
        <span className="font-semibold text-text-primary text-[14px] tracking-tight">Projects</span>
      </TopBar>
      <div className="flex-1 p-32 md:p-64 max-w-[900px] mx-auto w-full flex items-center">
        <EmptyWorkspace
          title="No projects yet"
          description="Your projects will be managed here, completely offline. Future updates will allow you to generate smart templates or instantiate a new project via the AI assistant."
          icon={<Layers className="w-10 h-10 text-text-secondary/50" />}
          action={
            <Button leftIcon={<FolderPlus className="w-4 h-4" />} size="md" disabled>
              Create Project
            </Button>
          }
        />
      </div>
    </div>
  )
}
