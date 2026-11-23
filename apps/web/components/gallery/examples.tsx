"use client"

import type { ReactNode } from "react"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { AspectRatio } from "@/components/ui/aspect-ratio"
import { Avatar, AvatarBadge, AvatarFallback, AvatarGroup, AvatarGroupCount } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb"
import { Button } from "@/components/ui/button"
import { ButtonGroup, ButtonGroupSeparator } from "@/components/ui/button-group"
import { Calendar } from "@/components/ui/calendar"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput, InputGroupText } from "@/components/ui/input-group"
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp"
import { Kbd, KbdGroup } from "@/components/ui/kbd"
import { Label } from "@/components/ui/label"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination"
import { Popover, PopoverContent, PopoverDescription, PopoverTitle, PopoverTrigger } from "@/components/ui/popover"
import { Progress, ProgressLabel, ProgressValue } from "@/components/ui/progress"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { Slider } from "@/components/ui/slider"
import { Spinner } from "@/components/ui/spinner"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Toggle } from "@/components/ui/toggle"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { advancedExamples } from "./advanced-examples"
import { moreExamples } from "./more-examples"

type Section = { id: string; title: string; description?: string; content: ReactNode }
const row = "flex flex-wrap items-center gap-3"
const stack = "flex w-full max-w-md flex-col gap-4"
const section = (id: string, title: string, content: ReactNode, description?: string): Section => ({ id, title, description, content })

export const sections: Section[] = [
  section("button", "Button", <div className="space-y-5"><div className={row}>{(["default", "secondary", "outline", "ghost", "destructive", "link"] as const).map(v => <Button key={v} variant={v}>{v}</Button>)}</div><div className={row}>{(["xs", "sm", "default", "lg"] as const).map(s => <Button key={s} size={s} variant="outline">{s}</Button>)}<Button disabled>Disabled</Button><Button><Spinner /> Loading</Button></div><div className={row}>{(["icon-xs", "icon-sm", "icon", "icon-lg"] as const).map(size => <div key={size} className="flex flex-col items-center gap-2"><Button size={size} variant="outline" aria-label={`Add, ${size}`}>+</Button><span className="text-xs text-muted-foreground">{size}</span></div>)}</div></div>, "Variants, sizes, and states"),
  section("button-group", "Button group", <ButtonGroup><Button variant="outline">Previous</Button><ButtonGroupSeparator /><Button variant="outline">Next</Button></ButtonGroup>),
  section("badge", "Badge", <div className={row}>{(["default", "secondary", "destructive", "outline", "ghost", "link"] as const).map(v => <Badge key={v} variant={v}>{v}</Badge>)}</div>),
  section("alert", "Alert", <div className={stack}><Alert><AlertTitle>Changes saved</AlertTitle><AlertDescription>Your preferences are up to date.</AlertDescription></Alert><Alert variant="destructive"><AlertTitle>Something went wrong</AlertTitle><AlertDescription>Please check your details and try again.</AlertDescription></Alert></div>),
  section("avatar", "Avatar", <div className={row}><Avatar size="sm"><AvatarFallback>SM</AvatarFallback></Avatar><Avatar><AvatarFallback>JD</AvatarFallback><AvatarBadge /></Avatar><Avatar size="lg"><AvatarFallback>LG</AvatarFallback></Avatar><AvatarGroup><Avatar><AvatarFallback>AL</AvatarFallback></Avatar><Avatar><AvatarFallback>MK</AvatarFallback></Avatar><AvatarGroupCount>+3</AvatarGroupCount></AvatarGroup></div>),
  section("accordion", "Accordion", <Accordion className="max-w-md"><AccordionItem value="one"><AccordionTrigger>What is included?</AccordionTrigger><AccordionContent>Reusable components built with accessible primitives.</AccordionContent></AccordionItem><AccordionItem value="two"><AccordionTrigger>Can I customize it?</AccordionTrigger><AccordionContent>Yes. Edit the components and tokens in your project.</AccordionContent></AccordionItem></Accordion>),
  section("aspect-ratio", "Aspect ratio", <div className="w-64"><AspectRatio ratio={16 / 9} className="flex items-center justify-center rounded-xl bg-muted text-sm text-muted-foreground">16 / 9</AspectRatio></div>),
  section("breadcrumb", "Breadcrumb", <Breadcrumb><BreadcrumbList><BreadcrumbItem>Home</BreadcrumbItem><BreadcrumbSeparator /><BreadcrumbItem>Library</BreadcrumbItem><BreadcrumbSeparator /><BreadcrumbItem><BreadcrumbPage>Components</BreadcrumbPage></BreadcrumbItem></BreadcrumbList></Breadcrumb>),
  section("calendar", "Calendar", <Calendar mode="single" className="rounded-xl border" />),
  section("card", "Card", <div className="flex flex-wrap gap-4"><Card className="w-full max-w-sm"><CardHeader><CardTitle>Project overview</CardTitle><CardDescription>A compact example of a content card.</CardDescription></CardHeader><CardContent><p className="text-sm">Your workspace is ready for the next idea.</p></CardContent><CardFooter><Button size="sm">View project</Button></CardFooter></Card><Card size="sm" className="w-full max-w-sm"><CardHeader><CardTitle>Small card</CardTitle><CardDescription>Compact spacing for smaller surfaces.</CardDescription></CardHeader><CardContent><p className="text-sm">A smaller variation.</p></CardContent></Card></div>),
  section("checkbox", "Checkbox", <div className={stack}><label className={row}><Checkbox defaultChecked /> Checked</label><label className={row}><Checkbox /> Unchecked</label><label className={row}><Checkbox disabled /> Disabled</label></div>),
  section("collapsible", "Collapsible", <Collapsible className="w-full max-w-sm space-y-3"><CollapsibleTrigger render={<Button variant="outline" />}>Toggle details</CollapsibleTrigger><CollapsibleContent className="rounded-xl border p-4 text-sm">This content can be expanded and collapsed.</CollapsibleContent></Collapsible>),
  section("command", "Command", <Command className="max-w-sm rounded-xl border"><CommandInput placeholder="Search commands..." /><CommandList><CommandEmpty>No results found.</CommandEmpty><CommandGroup heading="Suggestions"><CommandItem>Calendar</CommandItem><CommandItem>Search</CommandItem><CommandItem>Settings</CommandItem></CommandGroup></CommandList></Command>),
  section("dialog", "Dialog", <Dialog><DialogTrigger render={<Button variant="outline" />}>Open dialog</DialogTrigger><DialogContent><DialogHeader><DialogTitle>Edit profile</DialogTitle><DialogDescription>Update your information below.</DialogDescription></DialogHeader><Input aria-label="Name" defaultValue="Alex Morgan" /><DialogFooter showCloseButton /></DialogContent></Dialog>),
  section("alert-dialog", "Alert dialog", <AlertDialog><AlertDialogTrigger render={<Button variant="outline" />}>Open alert dialog</AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This is a preview of a confirmation dialog.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel></AlertDialogFooter></AlertDialogContent></AlertDialog>),
  section("dropdown-menu", "Dropdown menu", <DropdownMenu><DropdownMenuTrigger render={<Button variant="outline" />}>Open menu</DropdownMenuTrigger><DropdownMenuContent><DropdownMenuGroup><DropdownMenuLabel>My account</DropdownMenuLabel><DropdownMenuItem>Profile</DropdownMenuItem><DropdownMenuItem>Settings</DropdownMenuItem></DropdownMenuGroup><DropdownMenuSeparator /><DropdownMenuItem variant="destructive">Sign out</DropdownMenuItem></DropdownMenuContent></DropdownMenu>),
  section("input", "Input", <div className={stack}><Input placeholder="Default input" aria-label="Default input" /><Input placeholder="Invalid input" aria-label="Invalid input" aria-invalid /><Input placeholder="Disabled input" aria-label="Disabled input" disabled /></div>),
  section("input-group", "Input group", <div className={stack}>{(["inline-start", "inline-end", "block-start", "block-end"] as const).map(align => <InputGroup key={align}><InputGroupAddon align={align}><InputGroupText>{align}</InputGroupText></InputGroupAddon><InputGroupInput aria-label={`Input with ${align} addon`} placeholder="Enter a value" /></InputGroup>)}<InputGroup><InputGroupInput aria-label="Input with actions" placeholder="Try an action" /><InputGroupAddon align="inline-end">{(["xs", "sm", "icon-xs", "icon-sm"] as const).map(size => <InputGroupButton key={size} size={size} aria-label={`Action ${size}`}>{size.startsWith("icon") ? "+" : size}</InputGroupButton>)}</InputGroupAddon></InputGroup></div>),
  section("input-otp", "Input OTP", <InputOTP maxLength={6} aria-label="Verification code"><InputOTPGroup>{Array.from({length: 6}, (_, i) => <InputOTPSlot key={i} index={i} />)}</InputOTPGroup></InputOTP>),
  section("label", "Label", <div className={stack}><Label htmlFor="gallery-email">Email address</Label><Input id="gallery-email" type="email" placeholder="you@example.com" /></div>),
  section("kbd", "Keyboard shortcut", <KbdGroup><Kbd>âŒ˜</Kbd><Kbd>K</Kbd></KbdGroup>),
  section("native-select", "Native select", <NativeSelect aria-label="Choose a fruit" className="max-w-xs"><NativeSelectOption value="apple">Apple</NativeSelectOption><NativeSelectOption value="pear">Pear</NativeSelectOption></NativeSelect>),
  section("select", "Select", <div className={row}><Select><SelectTrigger className="w-48"><SelectValue placeholder="Choose a fruit" /></SelectTrigger><SelectContent><SelectItem value="apple">Apple</SelectItem><SelectItem value="pear">Pear</SelectItem><SelectItem value="orange">Orange</SelectItem></SelectContent></Select><Select><SelectTrigger size="sm" className="w-48"><SelectValue placeholder="Small select" /></SelectTrigger><SelectContent><SelectItem value="one">One</SelectItem><SelectItem value="two">Two</SelectItem></SelectContent></Select></div>),
  section("textarea", "Textarea", <Textarea className="max-w-md" aria-label="Message" placeholder="Write a message..." />),
  section("radio-group", "Radio group", <RadioGroup defaultValue="comfortable" aria-label="Density"><label className={row}><RadioGroupItem value="comfortable" /> Comfortable</label><label className={row}><RadioGroupItem value="compact" /> Compact</label><label className={row}><RadioGroupItem value="disabled" disabled /> Disabled</label></RadioGroup>),
  section("switch", "Switch", <div className={row}><label className={row}><Switch defaultChecked /> Enabled</label><label className={row}><Switch /> Off</label><label className={row}><Switch size="sm" defaultChecked /> Small</label><label className={row}><Switch disabled /> Disabled</label></div>),
  section("slider", "Slider", <div className="w-full max-w-sm"><Slider defaultValue={[40]} aria-label="Volume" /></div>),
  section("progress", "Progress", <Progress value={65} className="w-full max-w-sm"><ProgressLabel>Uploading</ProgressLabel><ProgressValue /></Progress>),
  section("spinner", "Spinner", <div className={row}><Spinner className="size-4" /><Spinner className="size-6" /><Spinner className="size-8" /></div>),
  section("skeleton", "Skeleton", <div className="flex items-center gap-4"><Skeleton className="size-12 rounded-full" /><div className="space-y-2"><Skeleton className="h-4 w-36" /><Skeleton className="h-4 w-24" /></div></div>),
  section("separator", "Separator", <div className="w-64 space-y-3 text-sm"><p>First section</p><Separator /><p>Second section</p></div>),
  section("tabs", "Tabs", <div className={stack}>{(["default", "line"] as const).map(v => <Tabs defaultValue="account" key={v}><TabsList variant={v}><TabsTrigger value="account">Account</TabsTrigger><TabsTrigger value="settings">Settings</TabsTrigger></TabsList><TabsContent value="account">Manage your account.</TabsContent><TabsContent value="settings">Manage your settings.</TabsContent></Tabs>)}</div>),
  section("toggle", "Toggle", <div className={row}><Toggle aria-label="Toggle bold">Bold</Toggle><Toggle variant="outline" aria-label="Toggle italic">Italic</Toggle><Toggle disabled>Disabled</Toggle></div>),
  section("toggle-group", "Toggle group", <ToggleGroup variant="outline" aria-label="Text alignment"><ToggleGroupItem value="left">Left</ToggleGroupItem><ToggleGroupItem value="center">Center</ToggleGroupItem><ToggleGroupItem value="right">Right</ToggleGroupItem></ToggleGroup>),
  section("tooltip", "Tooltip", <Tooltip><TooltipTrigger render={<Button variant="outline" />}>Hover or focus</TooltipTrigger><TooltipContent>Helpful information</TooltipContent></Tooltip>),
  section("popover", "Popover", <Popover><PopoverTrigger render={<Button variant="outline" />}>Open popover</PopoverTrigger><PopoverContent><PopoverTitle>Dimensions</PopoverTitle><PopoverDescription>Set the dimensions for this layer.</PopoverDescription><Input className="mt-3" aria-label="Width" defaultValue="100%" /></PopoverContent></Popover>),
  section("sheet", "Sheet", <Sheet><SheetTrigger render={<Button variant="outline" />}>Open sheet</SheetTrigger><SheetContent><SheetHeader><SheetTitle>Settings</SheetTitle><SheetDescription>Manage your preferences here.</SheetDescription></SheetHeader></SheetContent></Sheet>),
  section("pagination", "Pagination", <Pagination><PaginationContent><PaginationItem><PaginationPrevious href="#pagination" /></PaginationItem><PaginationItem><PaginationLink href="#pagination" isActive>1</PaginationLink></PaginationItem><PaginationItem><PaginationLink href="#pagination">2</PaginationLink></PaginationItem><PaginationItem><PaginationNext href="#pagination" /></PaginationItem></PaginationContent></Pagination>),
  section("table", "Table", <div className="w-full max-w-lg"><Table><TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Status</TableHead><TableHead>Role</TableHead></TableRow></TableHeader><TableBody><TableRow><TableCell>Alex Morgan</TableCell><TableCell><Badge variant="secondary">Active</Badge></TableCell><TableCell>Designer</TableCell></TableRow><TableRow><TableCell>Sam Lee</TableCell><TableCell><Badge variant="outline">Invited</Badge></TableCell><TableCell>Developer</TableCell></TableRow></TableBody></Table></div>),
  section("scroll-area", "Scroll area", <ScrollArea className="h-32 w-64 rounded-xl border p-4"><div className="space-y-3 text-sm">{Array.from({length: 10}, (_, i) => <p key={i}>Scrollable item {i + 1}</p>)}</div></ScrollArea>),
  section("resizable", "Resizable", <ResizablePanelGroup className="h-32 max-w-md rounded-xl border"><ResizablePanel defaultSize={50}><div className="grid h-full place-items-center text-sm">One</div></ResizablePanel><ResizableHandle withHandle /><ResizablePanel defaultSize={50}><div className="grid h-full place-items-center text-sm">Two</div></ResizablePanel></ResizablePanelGroup>),
  ...advancedExamples,
  ...moreExamples,
]
